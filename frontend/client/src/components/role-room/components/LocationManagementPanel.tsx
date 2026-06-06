import React, { useState, useMemo, useEffect, useId, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  InputAdornment,
  Chip,
  Stack,
  Checkbox,
  FormControlLabel,
  Tooltip,
  Collapse,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Skeleton,
  useMediaQuery,
  useTheme,
  Grow,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewModule as GridViewIcon,
  ViewList as TableViewIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  FileDownload as ExportIcon,
  FileCopy as DuplicateIcon,
  Map as MapIcon,
  Place as PlaceIcon,
  Assessment as AssessmentIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Explore as ExploreIcon,
  Group as GroupIcon,
  Engineering as EngineeringIcon,
  Verified as VerifiedIcon,
  Timeline as TimelineIcon,
  Landscape as OutdoorIcon,
  MeetingRoom as IndoorIcon,
  CameraAlt as StudioIcon,
  Language as VirtualIcon,
  Category as OtherTypeIcon,
  HomeWork as BasecampIcon,
  LocalShipping as LoadFlowIcon,
  Link as LinkIcon,
  Inventory2 as EquipmentIcon,
  Movie as StoryboardIcon,
  PhoneCallback as CallbackIcon,
  Checklist as CrewLinkIcon,
  Image as ImageIcon,
  AddPhotoAlternate as AddPhotoIcon,
  UploadFile as UploadFileIcon,
  HelpOutline as HelpIcon,
  CompareArrows as CompareArrowsIcon,
  LocalParking as ParkingIcon,
  Wifi as WifiIcon,
  Power as PowerIcon,
  Wc as WcIcon,
  Restaurant as CateringIcon,
  Checkroom as DressingRoomsIcon,
  MoreHoriz as MoreFacilityIcon,
} from '@mui/icons-material';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletMapTooltip,
  useMap,
} from 'react-leaflet';
import settingsService from '../services/settingsService';
import globalTagService from '../services/globalTagService';
import { 
  LocationsIcon as LocationIcon, 
  StatsIcon, 
  AnalyticsIcon,
  PersonNameIcon,
  AddressIcon,
  CapacityIcon,
} from './icons/CastingIcons';
import type { CastingProject, CastingShot, CrewMember, Location } from '../models/casting';
import { castingService } from '../services/castingService';
import { roleRoomAnalytics } from '../services/roleRoomAnalytics';
import { externalDataService } from '@/services/ExternalDataService';
import { LocationAnalysisDialog } from './LocationAnalysisDialog';
import { LocationManagementGuide } from './production/LocationManagementGuide';
import { useToast } from './ToastStack';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import locationPng from './icons/Keep/roleroom_location.png';
import { VerifyLocationDialog } from './VerifyLocationDialog';
import { LocationMapThumbnail } from './LocationMapThumbnail';
import { getRoleLabel, isTechnicalCrewMember as isTechnicalCrewMemberFromShared } from './shared/technicalCrew';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { useAuth } from '../../../hooks/useAuth';
import 'leaflet/dist/leaflet.css';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';

// Focus visible styles for WCAG 2.4.7
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #00d4ff',
    outlineOffset: 2,
  },
};

type SortField = 'name' | 'type' | 'capacity' | 'scenes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table' | 'pro';
type ProPresetId = 'all' | 'tech_scout' | 'permits' | 'night_shoot' | 'low_budget';
type OperationalFilterKey = 'all' | 'ready_today' | 'permit_missing' | 'high_risk' | 'over_budget' | 'with_shots';
type BulkWorkflowStatus = 'ready' | 'hold' | 'blocked';

interface SavedLocationProView {
  id: string;
  name: string;
  preset: ProPresetId;
  operationalFilter: OperationalFilterKey;
  searchQuery: string;
  filterType: Location['type'] | 'all';
  sortField: SortField;
  sortDirection: SortDirection;
}

interface LocationProMetrics {
  locationId: string;
  readinessScore: number;
  riskScore: number;
  riskLevel: 'lav' | 'moderat' | 'hoy';
  estimatedCost: number;
  overBudget: boolean;
  hasPermitEvidence: boolean;
  permitMissing: boolean;
  missingTechnicalRoles: string[];
  technicalCoverage: number;
  shotsCount: number;
  consistencyWarnings: string[];
}

const ROLE_ROOM_COLORS = {
  accent: '#a855f7',
  accentStrong: '#9333ea',
  accentSoft: 'rgba(168,85,247,0.18)',
  accentBorder: 'rgba(168,85,247,0.4)',
  secondary: '#22d3ee',
  secondarySoft: 'rgba(34,211,238,0.18)',
  mutedText: 'rgba(255,255,255,0.74)',
  panel: 'rgba(20,16,46,0.72)',
  panelBorder: 'rgba(168,85,247,0.22)',
};

const LOCATION_PRO_VIEWS_NAMESPACE = 'roleRoom_locationProViews';
const APPROVED_ANNOTATION_COLORS = new Set(['#a855f7', '#22d3ee', '#34d399', '#f59e0b', '#ef4444', '#c084fc', '#8b5cf6']);

const PRO_PRESET_LABELS: Record<ProPresetId, string> = {
  all: 'Alle',
  tech_scout: 'Tech Scout',
  permits: 'Tillatelser',
  night_shoot: 'Nattopptak',
  low_budget: 'Lavt budsjett',
};

const OPERATIONAL_FILTER_LABELS: Record<OperationalFilterKey, string> = {
  all: 'Alle',
  ready_today: 'Klar i dag',
  permit_missing: 'Mangler tillatelse',
  high_risk: 'Høy risiko',
  over_budget: 'Over budsjett',
  with_shots: 'Har shotlist',
};

interface LocationManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
  externalCreateSignal?: number;
  onExternalCreated?: (location: Location) => void;
  onExternalCreateCancelled?: () => void;
}

interface ProMapLocation {
  locationId: string;
  lat: number;
  lng: number;
  typeColor: string;
  name: string;
}

interface ProContactDraft {
  name: string;
  phone: string;
  email: string;
}

type LoadFlowStatus = 'planned' | 'ready' | 'in_progress' | 'completed';

interface ProLoadFlowDraft {
  loadInAt: string;
  shootStartAt: string;
  wrapAt: string;
  loadOutAt: string;
  status: LoadFlowStatus;
  notes: string;
}

interface ProSceneOption {
  id: string;
  label: string;
}

interface ProSceneInsight {
  sceneId: string;
  sceneLabel: string;
  shotCount: number;
  shotListCount: number;
  callbackCount: number;
  crewTouchpoints: number;
  equipment: string[];
  storyboardCount: number;
}

interface ProMediaAsset {
  id: string;
  url: string;
  caption?: string;
  sceneIds?: string[];
  createdAt?: string;
  source?: 'url' | 'upload';
}

interface ProMediaDraft {
  locationImages: ProMediaAsset[];
  storyboardImages: ProMediaAsset[];
  locationImageUrlInput: string;
  locationImageCaptionInput: string;
  storyboardImageUrlInput: string;
  storyboardImageCaptionInput: string;
  storyboardSceneIds: string[];
}

type ProSectionKey = 'summary' | 'loadFlow' | 'sceneLinks' | 'media' | 'contact';
type ProSectionState = Record<ProSectionKey, boolean>;

interface ConsistencyFinding {
  locationId: string;
  warning: string;
  targetSection: ProSectionKey;
  ctaLabel: string;
}

const DEFAULT_PRO_SECTION_STATE: ProSectionState = {
  summary: true,
  loadFlow: false,
  sceneLinks: false,
  media: false,
  contact: false,
};

const getConsistencyTargetSection = (warning: string): ProSectionKey => {
  const normalized = warning.toLowerCase();
  if (normalized.includes('load-in/load-out') || normalized.includes('flyt')) return 'loadFlow';
  if (normalized.includes('scene') || normalized.includes('shot') || normalized.includes('storyboard')) return 'sceneLinks';
  if (normalized.includes('kontakt') || normalized.includes('telefon') || normalized.includes('e-post')) return 'contact';
  return 'summary';
};

const getConsistencyCtaLabel = (section: ProSectionKey): string => {
  switch (section) {
    case 'loadFlow':
      return 'Gå til load-flow';
    case 'sceneLinks':
      return 'Gå til scene-kobling';
    case 'media':
      return 'Gå til media';
    case 'contact':
      return 'Gå til kontakt';
    default:
      return 'Rediger lokasjon';
  }
};

const buildProContactDraft = (location: Location): ProContactDraft => {
  const contactInfo = (location.contactInfo ?? {}) as Record<string, unknown>;
  return {
    name: typeof contactInfo.name === 'string' ? contactInfo.name : '',
    phone: typeof contactInfo.phone === 'string' ? contactInfo.phone : '',
    email: typeof contactInfo.email === 'string' ? contactInfo.email : '',
  };
};

const toDateTimeInputValue = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.trim())) return value.trim();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const formatDateTimeShort = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.length > 16 ? value.slice(0, 16) : value;
  }
  return parsed.toLocaleString('nb-NO', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toIsoOrRawDateTime = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return parsed.toISOString();
};

const normalizeSceneId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const normalizeSceneIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeSceneId(entry))
        .filter((entry): entry is string => Boolean(entry))
    )
  );
};

const normalizeLocationFacilities = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
};

const getLocationTypeValue = (type: Location['type']): NonNullable<Location['type']> => {
  if (typeof type === 'string' && type.trim().length > 0) return type;
  return 'other';
};

const getLocationAddressText = (address: unknown): string =>
  typeof address === 'string' ? address : '';

const getLocationCapacityValue = (capacity: unknown): number =>
  typeof capacity === 'number' && Number.isFinite(capacity) ? capacity : 0;

const readTextFromUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [
      record.name,
      record.label,
      record.title,
      record.itemName,
      record.equipmentName,
      record.displayName,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
  }
  return null;
};

const extractEquipmentLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readTextFromUnknown(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const countStoryboardAssets = (shot: CastingShot): number => {
  const frameLists = [
    (shot as any).storyboardFrames,
    (shot as any).storyboards,
    (shot as any).storyboard,
  ];
  for (const maybeList of frameLists) {
    if (Array.isArray(maybeList) && maybeList.length > 0) {
      return maybeList.length;
    }
  }
  if (
    typeof (shot as any).storyboardImageUrl === 'string' ||
    typeof (shot as any).storyboardImage === 'string' ||
    typeof (shot as any).storyboardUrl === 'string'
  ) {
    return 1;
  }
  return 0;
};

const buildProLoadFlowDraft = (location: Location): ProLoadFlowDraft => {
  const flow = ((location as any).loadFlow ?? {}) as Record<string, unknown>;
  const status = String(flow.status ?? 'planned').toLowerCase();
  const normalizedStatus: LoadFlowStatus =
    status === 'ready' || status === 'in_progress' || status === 'completed' ? (status as LoadFlowStatus) : 'planned';
  return {
    loadInAt: toDateTimeInputValue(flow.loadInAt),
    shootStartAt: toDateTimeInputValue(flow.shootStartAt),
    wrapAt: toDateTimeInputValue(flow.wrapAt),
    loadOutAt: toDateTimeInputValue(flow.loadOutAt),
    status: normalizedStatus,
    notes: typeof flow.notes === 'string' ? flow.notes : '',
  };
};

const MAX_MEDIA_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const createProMediaAssetId = (): string =>
  `loc-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeProMediaAssets = (value: unknown): ProMediaAsset[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map<ProMediaAsset | null>((entry) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        if (!url) return null;
        return {
          id: createProMediaAssetId(),
          url,
          source: 'url' as const,
        };
      }
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const urlCandidates = [record.url, record.imageUrl, record.src, record.path];
      const url = urlCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim()) as
        | string
        | undefined;
      if (!url) return null;
      const id =
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : createProMediaAssetId();
      const caption =
        (typeof record.caption === 'string' && record.caption.trim()) ||
        (typeof record.title === 'string' && record.title.trim()) ||
        undefined;
      const sceneIds = normalizeSceneIds(record.sceneIds ?? record.scenes ?? record.scene_ids);
      return {
        id,
        url: url.trim(),
        caption,
        sceneIds: sceneIds.length > 0 ? sceneIds : undefined,
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
        source: record.source === 'upload' ? 'upload' : 'url',
      };
    })
    .filter((entry): entry is ProMediaAsset => entry !== null);
};

const buildProMediaDraft = (location: Location): ProMediaDraft => {
  const locationRecord = location as Record<string, unknown>;
  const media =
    locationRecord.media && typeof locationRecord.media === 'object'
      ? (locationRecord.media as Record<string, unknown>)
      : {};

  const locationImages = normalizeProMediaAssets(
    media.locationImages ?? locationRecord.locationImages ?? locationRecord.referenceImages
  );
  const storyboardImages = normalizeProMediaAssets(
    media.storyboardImages ?? locationRecord.storyboardImages ?? locationRecord.storyboardRefs
  );

  return {
    locationImages,
    storyboardImages,
    locationImageUrlInput: '',
    locationImageCaptionInput: '',
    storyboardImageUrlInput: '',
    storyboardImageCaptionInput: '',
    storyboardSceneIds: [],
  };
};

const buildProMediaAsset = (
  url: string,
  caption: string,
  sceneIds: string[] = [],
  source: 'url' | 'upload' = 'url'
): ProMediaAsset => ({
  id: createProMediaAssetId(),
  url: url.trim(),
  caption: caption.trim() || undefined,
  sceneIds: sceneIds.length > 0 ? Array.from(new Set(sceneIds)) : undefined,
  createdAt: new Date().toISOString(),
  source,
});

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.length > 0) {
        resolve(result);
      } else {
        reject(new Error('Kunne ikke lese fil'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Feil ved filopplasting'));
    reader.readAsDataURL(file);
  });

function LocationLeafletSync({
  bounds,
  activeLocation,
}: {
  bounds: Array<[number, number]>;
  activeLocation: ProMapLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds.length === 0) return;
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14, animate: false });
  }, [map, bounds]);

  useEffect(() => {
    if (!activeLocation) return;
    const target: [number, number] = [activeLocation.lat, activeLocation.lng];
    const current = map.getCenter();
    const isSameCenter =
      Math.abs(current.lat - target[0]) < 0.0001 && Math.abs(current.lng - target[1]) < 0.0001;
    if (isSameCenter) return;
    map.flyTo(target, Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [map, activeLocation]);

  return null;
}

export function LocationManagementPanel({
  projectId,
  onUpdate,
  externalCreateSignal,
  onExternalCreated,
  onExternalCreateCancelled,
}: LocationManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const is2KViewport = useMediaQuery('(min-width: 2048px)');
  const is4KViewport = useMediaQuery('(min-width: 3840px)');
  const is5KViewport = useMediaQuery('(min-width: 5120px)');
  const proMapMinHeight = is5KViewport ? 520 : is4KViewport ? 460 : is2KViewport ? 380 : isMobile ? 220 : 260;

  // Unique IDs for WCAG
  const baseId = useId();
  const dialogTitleId = `${baseId}-dialog-title`;
  const dialogDescId = `${baseId}-dialog-desc`;

  // Toast notifications
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const { user } = useAuth();
  const noteActorLabel = useMemo(() => {
    const raw = user?.displayName ?? user?.name ?? user?.email;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : 'Ukjent bruker';
  }, [user]);
  const noteActorId = user?.id !== undefined && user?.id !== null ? String(user.id) : undefined;

  // Core state
  const [locations, setLocations] = useState<Location[]>([]);
  const [projectContext, setProjectContext] = useState<CastingProject | null>(null);
  const [projectContextLoading, setProjectContextLoading] = useState(false);
  
  // Load locations when projectId changes
  useEffect(() => {
    const loadLocations = async () => {
      if (projectId) {
        try {
          const locs = await castingService.getLocations(projectId);
          setLocations(Array.isArray(locs) ? locs : []);
        } catch (error) {
          console.error('Error loading locations:', error);
          setLocations([]);
        }
      }
    };
    loadLocations();
  }, [projectId]);

  useEffect(() => {
    const loadProjectContext = async () => {
      if (!projectId) {
        setProjectContext(null);
        return;
      }
      setProjectContextLoading(true);
      try {
        const project = await castingService.getProject(projectId);
        setProjectContext(project);
      } catch (error) {
        console.warn('Could not load project context for location pro view:', error);
        setProjectContext(null);
      } finally {
        setProjectContextLoading(false);
      }
    };
    loadProjectContext();
  }, [projectId]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const externalCreateSignalRef = useRef(0);
  const externalCreatePendingRef = useRef(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [selectedLocationForAnalysis, setSelectedLocationForAnalysis] = useState<Location | null>(null);
  const [validatingAddress, setValidatingAddress] = useState(false);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<Location['type'] | 'all'>('all');
  const [filterFacility, setFilterFacility] = useState<string>('all');
  const [filterCoordinates, setFilterCoordinates] = useState<'all' | 'with' | 'without'>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  // Verifiserings-dialog (Kartverket-diff). Trigges fra ⋯-meny eller knapp per kort.
  const [verifyingLocation, setVerifyingLocation] = useState<Location | null>(null);
  // Adresse-autocomplete-state (Kartverket Geonorge-API).
  // Lar brukeren søke på navn/adresse-tekst og auto-fyller koordinater i
  // bakgrunnen — koordinater eksponeres aldri direkte for brukeren.
  const [addressSuggestions, setAddressSuggestions] = useState<
    Array<{ address: string; municipality: string; county: string; postalCode: string; coordinates: { lat: number; lng: number } }>
  >([]);
  const [addressSuggestionsLoading, setAddressSuggestionsLoading] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');

  // Nylig brukte adresser — lokal cache av de siste 20 valgte adressene
  // for å gi raskere flyt for innholdsprodusenter som lager flere prosjekter
  // på samme lokasjoner. Versjonert localStorage-key for kompatibilitet ved
  // fremtidige shape-endringer.
  type RecentAddress = {
    address: string;
    municipality: string;
    county: string;
    postalCode: string;
    coordinates: { lat: number; lng: number };
    usedAt: number;
  };
  const RECENT_ADDRESSES_KEY = `roleroom_recent_addresses_v1_${projectId}`;
  const RECENT_ADDRESSES_MAX = 20;
  const [recentAddresses, setRecentAddresses] = useState<RecentAddress[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_ADDRESSES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .filter((e: unknown): e is RecentAddress =>
          typeof e === 'object' && e !== null
          && typeof (e as RecentAddress).address === 'string'
          && (e as RecentAddress).address.length > 0,
        )
        .slice(0, RECENT_ADDRESSES_MAX);
      setRecentAddresses(cleaned);
    } catch {
      /* graceful fallback ved corrupt JSON / localStorage utilgjengelig */
    }
  }, [RECENT_ADDRESSES_KEY]);

  const rememberRecentAddress = useCallback(
    (entry: Omit<RecentAddress, 'usedAt'>) => {
      if (!entry.address?.trim()) return;
      setRecentAddresses((prev) => {
        const deduped = prev.filter((r) => r.address !== entry.address);
        const next: RecentAddress[] = [{ ...entry, usedAt: Date.now() }, ...deduped].slice(
          0,
          RECENT_ADDRESSES_MAX,
        );
        try {
          localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(next));
        } catch {
          /* quota exceeded / private mode — ikke kritisk */
        }
        return next;
      });
    },
    [RECENT_ADDRESSES_KEY],
  );
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [proPreset, setProPreset] = useState<ProPresetId>('all');
  const [operationalFilter, setOperationalFilter] = useState<OperationalFilterKey>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [locationGuideOpen, setLocationGuideOpen] = useState(false);
  const [activeMapLocationId, setActiveMapLocationId] = useState<string | null>(null);
  const [consistencyIndicator, setConsistencyIndicator] = useState<{
    locationId: string;
    section: ProSectionKey;
    activatedAt: number;
  } | null>(null);
  const [bulkWorkflowStatus, setBulkWorkflowStatus] = useState<BulkWorkflowStatus>('ready');
  const [proPageSize, setProPageSize] = useState(24);
  const [savedProViews, setSavedProViews] = useState<SavedLocationProView[]>([]);
  const [savedViewsLoaded, setSavedViewsLoaded] = useState(false);
  const [selectedProViewId, setSelectedProViewId] = useState<string>('custom');
  const [proViewName, setProViewName] = useState('');

  useEffect(() => {
    const loadSavedViews = async () => {
      try {
        const views = await settingsService.getSetting<SavedLocationProView[]>(LOCATION_PRO_VIEWS_NAMESPACE, { projectId });
        if (Array.isArray(views)) {
          setSavedProViews(views);
        }
      } catch (error) {
        console.warn('Could not load saved location pro views:', error);
      } finally {
        setSavedViewsLoaded(true);
      }
    };
    loadSavedViews();
  }, [projectId]);

  useEffect(() => {
    if (!savedViewsLoaded) return;
    void settingsService.setSetting(LOCATION_PRO_VIEWS_NAMESPACE, savedProViews, { projectId });
  }, [savedProViews, savedViewsLoaded, projectId]);

  useEffect(() => {
    setSelectedProViewId('custom');
    setProViewName('');
    setProPageSize(24);
    setActiveMapLocationId(null);
    setOperationalFilter('all');
    setProPreset('all');
  }, [projectId]);

  useEffect(() => {
    if (!consistencyIndicator) return;
    const timer = window.setTimeout(() => {
      setConsistencyIndicator((current) =>
        current?.activatedAt === consistencyIndicator.activatedAt ? null : current
      );
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [consistencyIndicator]);

  useEffect(() => {
    if (selectedProViewId === 'custom') return;
    const selected = savedProViews.find((view) => view.id === selectedProViewId);
    if (!selected) {
      setSelectedProViewId('custom');
      return;
    }
    const hasChanged =
      selected.preset !== proPreset ||
      selected.operationalFilter !== operationalFilter ||
      selected.searchQuery !== searchQuery ||
      selected.filterType !== filterType ||
      selected.sortField !== sortField ||
      selected.sortDirection !== sortDirection;
    if (hasChanged) {
      setSelectedProViewId('custom');
    }
  }, [selectedProViewId, savedProViews, proPreset, operationalFilter, searchQuery, filterType, sortField, sortDirection]);

  useEffect(() => {
    setProPageSize(24);
  }, [searchQuery, filterType, sortField, sortDirection, proPreset, operationalFilter]);

  // Adresse-autocomplete: debounced 300ms-fetch til Kartverket.
  // Cancel-flagg via AbortController hindrer race-betingelser når brukeren
  // skriver raskt. Cache (60s) ligger i ExternalDataService.
  useEffect(() => {
    const trimmed = addressQuery.trim();
    if (trimmed.length < 2) {
      setAddressSuggestions([]);
      setAddressSuggestionsLoading(false);
      return;
    }
    const controller = new AbortController();
    setAddressSuggestionsLoading(true);
    const handle = setTimeout(async () => {
      try {
        const results = await externalDataService.searchKartverketAddressSuggestions(trimmed, {
          limit: 10,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setAddressSuggestions(results);
          setAddressSuggestionsLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setAddressSuggestions([]);
          setAddressSuggestionsLoading(false);
        }
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [addressQuery]);

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Favorites with database sync
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  
  const FAVORITES_NAMESPACE = 'virtualStudio_locationFavorites';

  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'location');
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

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Undo delete
  const [deletedLocation, setDeletedLocation] = useState<Location | null>(null);
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);

  // Expanded cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingProContactIds, setEditingProContactIds] = useState<Set<string>>(new Set());
  const [savingProContactIds, setSavingProContactIds] = useState<Set<string>>(new Set());
  const [proContactDrafts, setProContactDrafts] = useState<Record<string, ProContactDraft>>({});
  const [savingBasecampIds, setSavingBasecampIds] = useState<Set<string>>(new Set());
  const [editingLoadFlowIds, setEditingLoadFlowIds] = useState<Set<string>>(new Set());
  const [savingLoadFlowIds, setSavingLoadFlowIds] = useState<Set<string>>(new Set());
  const [loadFlowDrafts, setLoadFlowDrafts] = useState<Record<string, ProLoadFlowDraft>>({});
  const [editingSceneLinkIds, setEditingSceneLinkIds] = useState<Set<string>>(new Set());
  const [savingSceneLinkIds, setSavingSceneLinkIds] = useState<Set<string>>(new Set());
  const [sceneLinkDrafts, setSceneLinkDrafts] = useState<Record<string, string[]>>({});
  const [editingMediaIds, setEditingMediaIds] = useState<Set<string>>(new Set());
  const [savingMediaIds, setSavingMediaIds] = useState<Set<string>>(new Set());
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, ProMediaDraft>>({});
  const [proSectionStates, setProSectionStates] = useState<Record<string, ProSectionState>>({});

  // Form data
  const [formData, setFormData] = useState<Partial<Location>>({
    name: '',
    address: '',
    type: 'indoor',
    capacity: undefined,
    facilities: [],
    availability: {},
    assignedScenes: [],
    notes: '',
  });
  const mentionCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...locations.map((location) => location.name),
            formData.contactInfo?.name,
            formData.name,
          ]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length >= 2),
        ),
      ),
    [formData.contactInfo?.name, formData.name, locations],
  );
  const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
    const current = typeof sourceText === 'string' ? sourceText : '';
    if (!current.trim()) return name;
    const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
    return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
  };

  const locationTypes: Location['type'][] = ['studio', 'outdoor', 'indoor', 'virtual', 'other'];
  const commonFacilities = ['parking', 'restrooms', 'catering', 'wifi', 'power', 'dressing_rooms'];

  // Responsive padding
  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  // Save favorites to database and settings cache
  useEffect(() => {
    const saveFavorites = async () => {
      const values = [...favorites];
      await settingsService.setSetting(FAVORITES_NAMESPACE, values, { projectId });
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        await favoritesApi.set(projectId, 'location', values);
      } catch (error) {
        console.warn('Database save failed:', error);
      }
    };
    if (!favoritesLoaded) return;
    saveFavorites();
  }, [favorites, projectId, favoritesLoaded]);

  const getTypeLabel = (type: Location['type']): string => {
    const labels: Record<NonNullable<Location['type']>, string> = {
      studio: 'Studio',
      outdoor: 'Utendørs',
      indoor: 'Innendørs',
      virtual: 'Virtuell',
      other: 'Annet',
    };
    const normalizedType = getLocationTypeValue(type);
    return labels[normalizedType] || normalizedType;
  };

  const getTypeColor = (type: Location['type']): string => {
    const colors: Record<NonNullable<Location['type']>, string> = {
      studio: '#c084fc',
      outdoor: '#34d399',
      indoor: '#22d3ee',
      virtual: '#a855f7',
      other: '#94a3b8',
    };
    return colors[getLocationTypeValue(type)] || '#94a3b8';
  };

  const getTypeStatIcon = (type: string) => {
    const iconSx = {
      fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 },
      color: getTypeColor(type as Location['type']),
    };
    switch (type) {
      case 'outdoor':
        return <OutdoorIcon sx={iconSx} />;
      case 'indoor':
        return <IndoorIcon sx={iconSx} />;
      case 'studio':
        return <StudioIcon sx={iconSx} />;
      case 'virtual':
        return <VirtualIcon sx={iconSx} />;
      default:
        return <OtherTypeIcon sx={iconSx} />;
    }
  };

  const getFacilityLabel = (facility: string): string => {
    const labels: Record<string, string> = {
      parking: 'Parkering',
      restrooms: 'Toaletter',
      catering: 'Catering',
      wifi: 'WiFi',
      power: 'Strøm',
      dressing_rooms: 'Garderober',
    };
    return labels[facility] || facility;
  };

  /**
   * Returnerer regional label for filtrering. Prioritert kilde:
   *   1. loc.county (fylke) — fra autocomplete-data via Kartverket
   *   2. loc.municipality (kommune) — fra autocomplete-data via Kartverket
   *   3. Heuristisk parsing av poststed fra address-streng (siste komma-del)
   *   4. tom streng (vises som "Ukjent")
   *
   * Brukes både for å bygge dropdown-listen og for å filtrere.
   */
  const getLocationRegion = useCallback((loc: Location): string => {
    const county = (loc.county as string | undefined)?.trim();
    if (county) return county;
    const municipality = (loc.municipality as string | undefined)?.trim();
    if (municipality) return municipality;
    if (loc.address) {
      // "Karl Johans gate 5, 0154 Oslo" → "Oslo"
      const parts = loc.address.split(',').map((p) => p.trim()).filter(Boolean);
      const last = parts[parts.length - 1] || '';
      // Fjern postnummer (4-sifret tall) hvis det leder
      const noPostal = last.replace(/^\d{4}\s+/, '').trim();
      if (noPostal) return noPostal;
    }
    return '';
  }, []);

  // Kompakt ikon per fasilitet — brukt i kort-pill-rad som matcher design.
  // Returnerer null for ukjente fasiliteter slik at de filtreres ut av
  // ikon-raden (de vises fortsatt som tekst-chip i den utvidede listen).
  const getFacilityIcon = (facility: string): React.ReactNode => {
    switch (facility) {
      case 'parking': return <ParkingIcon sx={{ fontSize: 14 }} />;
      case 'wifi': return <WifiIcon sx={{ fontSize: 14 }} />;
      case 'power': return <PowerIcon sx={{ fontSize: 14 }} />;
      case 'restrooms': return <WcIcon sx={{ fontSize: 14 }} />;
      case 'catering': return <CateringIcon sx={{ fontSize: 14 }} />;
      case 'dressing_rooms': return <DressingRoomsIcon sx={{ fontSize: 14 }} />;
      default: return null;
    }
  };

  // Filter and sort locations
  const filteredAndSortedLocations = useMemo(() => {
    let result = [...locations];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (loc) =>
          loc.name.toLowerCase().includes(query) ||
          getLocationAddressText(loc.address).toLowerCase().includes(query) ||
          getTypeLabel(loc.type).toLowerCase().includes(query) ||
          (loc.notes && loc.notes.toLowerCase().includes(query))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((loc) => loc.type === filterType);
    }

    // Facility filter: behold kun lokasjoner med valgt fasilitet i listen
    if (filterFacility !== 'all') {
      result = result.filter((loc) =>
        Array.isArray(loc.facilities) && loc.facilities.includes(filterFacility),
      );
    }

    // Koordinat-filter: 'with' = må ha koordinater, 'without' = må mangle
    if (filterCoordinates !== 'all') {
      result = result.filter((loc) => {
        const hasCoords = Boolean(loc.coordinates?.lat && loc.coordinates?.lng);
        return filterCoordinates === 'with' ? hasCoords : !hasCoords;
      });
    }

    // Region-filter (fylke/kommune/poststed): bruker samme extractor som
    // dropdown-listen, så filter-match alltid stemmer
    if (filterRegion !== 'all') {
      result = result.filter((loc) => getLocationRegion(loc) === filterRegion);
    }

    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'nb');
          break;
        case 'type':
          comparison = getTypeLabel(a.type).localeCompare(getTypeLabel(b.type), 'nb');
          break;
        case 'capacity':
          comparison = getLocationCapacityValue(a.capacity) - getLocationCapacityValue(b.capacity);
          break;
        case 'scenes':
          comparison = normalizeSceneIds(a.assignedScenes).length - normalizeSceneIds(b.assignedScenes).length;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [locations, searchQuery, filterType, filterFacility, filterCoordinates, filterRegion, sortField, sortDirection, favorites, getLocationRegion]);

  // Bygg unik liste av regioner som finnes i nåværende locations (sortert
  // alfabetisk). Filtreres så bare regioner med ≥ 1 location vises.
  const availableRegions = useMemo<string[]>(() => {
    const set = new Set<string>();
    locations.forEach((loc) => {
      const region = getLocationRegion(loc);
      if (region) set.add(region);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'nb'));
  }, [locations, getLocationRegion]);

  // Statistics
  const stats = useMemo(() => {
    const typeCount = locations.reduce((acc, loc) => {
      const typeKey = getLocationTypeValue(loc.type);
      acc[typeKey] = (acc[typeKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalCapacity = locations.reduce((sum, loc) => sum + getLocationCapacityValue(loc.capacity), 0);
    const withCoordinates = locations.filter((loc) => loc.coordinates).length;

    return {
      total: locations.length,
      typeCount,
      totalCapacity,
      withCoordinates,
      favorites: favorites.size,
    };
  }, [locations, favorites]);

  const allShots = useMemo<CastingShot[]>(() => {
    const shotLists = projectContext?.shotLists;
    if (!Array.isArray(shotLists) || shotLists.length === 0) return [];
    return shotLists.flatMap((shotList) => (Array.isArray(shotList.shots) ? shotList.shots : []));
  }, [projectContext?.shotLists]);

  const technicalCrewPool = useMemo<CrewMember[]>(() => {
    const crew = projectContext?.crew;
    if (!Array.isArray(crew) || crew.length === 0) return [];
    return crew.filter(
      (member) =>
        isTechnicalCrewMemberFromShared(member as CrewMember, 'all') &&
        String(member.status ?? '').toLowerCase() !== 'unavailable'
    );
  }, [projectContext?.crew]);

  const callbackSchedules = useMemo(() => {
    const schedules = Array.isArray(projectContext?.schedules) ? projectContext.schedules : [];
    return schedules.filter((schedule) => {
      const type = String(schedule.type ?? '').toLowerCase();
      const status = String(schedule.status ?? '').toLowerCase();
      const notes = String(schedule.notes ?? '').toLowerCase();
      return type.includes('callback') || status.includes('callback') || notes.includes('callback');
    });
  }, [projectContext?.schedules]);

  const proSceneOptions = useMemo<ProSceneOption[]>(() => {
    const sceneMap = new Map<string, ProSceneOption>();

    const sceneBreakdowns = Array.isArray(projectContext?.sceneBreakdowns)
      ? projectContext.sceneBreakdowns
      : [];
    for (const scene of sceneBreakdowns) {
      const sceneId = normalizeSceneId(scene.id) ?? normalizeSceneId(scene.sceneNumber);
      if (!sceneId) continue;
      const label =
        (typeof scene.sceneName === 'string' && scene.sceneName.trim()) ||
        (typeof scene.heading === 'string' && scene.heading.trim()) ||
        `Scene ${scene.sceneNumber ?? sceneId}`;
      if (!sceneMap.has(sceneId)) {
        sceneMap.set(sceneId, { id: sceneId, label });
      }
    }

    const shotLists = Array.isArray(projectContext?.shotLists) ? projectContext.shotLists : [];
    for (const list of shotLists) {
      const sceneId = normalizeSceneId(list.sceneId ?? list.scene_id);
      if (!sceneId) continue;
      const label =
        (typeof list.sceneName === 'string' && list.sceneName.trim()) ||
        sceneMap.get(sceneId)?.label ||
        `Scene ${sceneId}`;
      if (!sceneMap.has(sceneId)) {
        sceneMap.set(sceneId, { id: sceneId, label });
      }
    }

    for (const shot of allShots) {
      const sceneId = normalizeSceneId(shot.sceneId);
      if (!sceneId) continue;
      if (!sceneMap.has(sceneId)) {
        sceneMap.set(sceneId, { id: sceneId, label: `Scene ${sceneId}` });
      }
    }

    return Array.from(sceneMap.values()).sort((a, b) => a.label.localeCompare(b.label, 'nb'));
  }, [projectContext?.sceneBreakdowns, projectContext?.shotLists, allShots]);

  const proSceneLabelById = useMemo(
    () => new Map(proSceneOptions.map((scene) => [scene.id, scene.label])),
    [proSceneOptions]
  );

  const proSceneInsightsById = useMemo<Record<string, ProSceneInsight>>(() => {
    const optionMap = new Map(proSceneOptions.map((scene) => [scene.id, scene]));
    const accumulator = new Map<
      string,
      {
        sceneLabel: string;
        shotCount: number;
        shotListCount: number;
        callbackCount: number;
        storyboardCount: number;
        equipment: Set<string>;
        crew: Set<string>;
      }
    >();

    const ensureEntry = (sceneId: string) => {
      const existing = accumulator.get(sceneId);
      if (existing) return existing;
      const created = {
        sceneLabel: optionMap.get(sceneId)?.label ?? `Scene ${sceneId}`,
        shotCount: 0,
        shotListCount: 0,
        callbackCount: 0,
        storyboardCount: 0,
        equipment: new Set<string>(),
        crew: new Set<string>(),
      };
      accumulator.set(sceneId, created);
      return created;
    };

    const shotLists = Array.isArray(projectContext?.shotLists) ? projectContext.shotLists : [];
    for (const list of shotLists) {
      const listSceneId = normalizeSceneId(list.sceneId ?? list.scene_id);
      if (!listSceneId) continue;
      const listEntry = ensureEntry(listSceneId);
      listEntry.shotListCount += 1;
      extractEquipmentLabels(list.equipment).forEach((label) => listEntry.equipment.add(label));

      for (const shot of Array.isArray(list.shots) ? list.shots : []) {
        const shotSceneId = normalizeSceneId(shot.sceneId) ?? listSceneId;
        const entry = ensureEntry(shotSceneId);
        entry.shotCount += 1;
        entry.storyboardCount += countStoryboardAssets(shot);
        extractEquipmentLabels((shot as any).equipment).forEach((label) => entry.equipment.add(label));
        extractEquipmentLabels((shot as any).requiredEquipment).forEach((label) => entry.equipment.add(label));
        extractEquipmentLabels((shot as any).gear).forEach((label) => entry.equipment.add(label));

        if (Array.isArray(shot.assignments)) {
          shot.assignments.forEach((assignment) => {
            const roleName = readTextFromUnknown((assignment as any).roleName ?? (assignment as any).roleId);
            const personName = readTextFromUnknown((assignment as any).name ?? (assignment as any).personId);
            if (roleName) entry.crew.add(roleName);
            else if (personName) entry.crew.add(personName);
          });
        } else {
          const assignee = readTextFromUnknown((shot as any).assigneeName ?? (shot as any).assigneeId);
          if (assignee) entry.crew.add(assignee);
        }
      }
    }

    callbackSchedules.forEach((schedule) => {
      const scheduleSceneId = normalizeSceneId(schedule.sceneId ?? schedule.scene_id);
      if (!scheduleSceneId) return;
      const entry = ensureEntry(scheduleSceneId);
      entry.callbackCount += 1;
    });

    return Array.from(accumulator.entries()).reduce<Record<string, ProSceneInsight>>((acc, [sceneId, entry]) => {
      acc[sceneId] = {
        sceneId,
        sceneLabel: entry.sceneLabel,
        shotCount: entry.shotCount,
        shotListCount: entry.shotListCount,
        callbackCount: entry.callbackCount,
        crewTouchpoints: entry.crew.size,
        equipment: Array.from(entry.equipment).sort((a, b) => a.localeCompare(b, 'nb')),
        storyboardCount: entry.storyboardCount,
      };
      return acc;
    }, {});
  }, [proSceneOptions, projectContext?.shotLists, callbackSchedules]);

  const locationProMetrics = useMemo<LocationProMetrics[]>(() => {
    const requiredTechnicalRoles = ['cinematographer', 'camera_operator', 'gaffer', 'sound_engineer'];
    const activeTechnicalRoles = new Set(
      technicalCrewPool.map((member) => String(member.role ?? '').toLowerCase())
    );
    const budget = projectContext?.budget;

    return locations.map((location) => {
      const facilities = Array.isArray(location.facilities) ? location.facilities : [];
      const assignedScenes = Array.isArray(location.assignedScenes) ? location.assignedScenes : [];
      const shotsCount = allShots.filter((shot) => {
        if (shot.locationId && shot.locationId === location.id) return true;
        if (shot.sceneId && assignedScenes.includes(String(shot.sceneId))) return true;
        return false;
      }).length;

      const notesBlob = `${String(location.notes ?? '')} ${String(location.accessNotes ?? '')}`.toLowerCase();
      const hasPermitFromText = /(permit|tillatelse|godkjent|approval|filming permit)/i.test(notesBlob);
      const hasPermitFromAnalysis = Boolean((location as any).propertyAnalysis?.droneRestrictions?.allowed);
      const hasPermitEvidence = hasPermitFromText || hasPermitFromAnalysis;
      const permitMissing = !hasPermitEvidence;
      const hasCoordinates = Boolean(location.coordinates?.lat && location.coordinates?.lng);
      const hasContact = Boolean(location.contactInfo?.name || location.contactInfo?.phone || location.contactInfo?.email);
      const isBasecamp = Boolean((location as any).isBasecamp);
      const loadFlowStatus = String((location as any).loadFlow?.status ?? '').toLowerCase();
      const missingTechnicalRoles = requiredTechnicalRoles.filter((role) => !activeTechnicalRoles.has(role));

      let readinessScore = 0;
      if (hasCoordinates) readinessScore += 25;
      readinessScore += facilities.length >= 3 ? 25 : facilities.length > 0 ? 10 : 0;
      if (hasContact) readinessScore += 15;
      if (hasPermitEvidence) readinessScore += 15;
      if (assignedScenes.length > 0) readinessScore += 10;
      if (isBasecamp) readinessScore += 5;
      if (loadFlowStatus === 'completed' || loadFlowStatus === 'ready') readinessScore += 8;
      else if (loadFlowStatus === 'in_progress') readinessScore += 4;
      readinessScore += missingTechnicalRoles.length === 0 ? 10 : missingTechnicalRoles.length <= 1 ? 5 : 0;
      if ((location as any).propertyAnalysis) readinessScore += 10;
      readinessScore = Math.min(100, readinessScore);

      const locationTypeMultiplier =
        location.type === 'outdoor' ? 1.4 : location.type === 'studio' ? 1.22 : location.type === 'virtual' ? 0.85 : 1;
      const estimatedCost = Math.round(
        (1400 +
          (location.capacity || 0) * 22 +
          assignedScenes.length * 550 +
          shotsCount * 180 +
          (permitMissing ? 1200 : 0) +
          missingTechnicalRoles.length * 450) *
          locationTypeMultiplier
      );
      const overBudget = Boolean(
        typeof budget === 'number' && budget > 0 && estimatedCost > Math.max(6000, budget * 0.18)
      );

      let riskScore = 0;
      if (!hasCoordinates) riskScore += 28;
      if (permitMissing) riskScore += 22;
      if (facilities.length === 0) riskScore += 18;
      if (missingTechnicalRoles.length >= 2) riskScore += 16;
      if (!hasContact) riskScore += 10;
      if (overBudget) riskScore += 12;
      if (assignedScenes.length === 0) riskScore += 6;
      if (assignedScenes.length > 0 && !loadFlowStatus) riskScore += 8;
      riskScore = Math.min(100, riskScore);

      const consistencyWarnings: string[] = [];
      const annotationColor = String((location as any).annotationColor ?? '').toLowerCase();
      if (annotationColor && !APPROVED_ANNOTATION_COLORS.has(annotationColor)) {
        consistencyWarnings.push('Annoteringsfarge avviker fra standardpaletten.');
      }
      if (location.type === 'outdoor' && !hasCoordinates) {
        consistencyWarnings.push('Utendørslokasjon mangler koordinater.');
      }
      if (!location.address) {
        consistencyWarnings.push('Mangler adressefelt.');
      }
      if (hasCoordinates && !location.address) {
        consistencyWarnings.push('Koordinater uten tekstadresse.');
      }
      if (new Set(facilities).size !== facilities.length) {
        consistencyWarnings.push('Dupliserte fasilitet-tags.');
      }
      if (assignedScenes.length > 0 && !loadFlowStatus) {
        consistencyWarnings.push('Scener er koblet, men load-in/load-out flyt mangler.');
      }

      const riskLevel: LocationProMetrics['riskLevel'] =
        riskScore >= 55 ? 'hoy' : riskScore >= 30 ? 'moderat' : 'lav';

      return {
        locationId: location.id,
        readinessScore,
        riskScore,
        riskLevel,
        estimatedCost,
        overBudget,
        hasPermitEvidence,
        permitMissing,
        missingTechnicalRoles,
        technicalCoverage: Math.max(
          0,
          Math.round(((requiredTechnicalRoles.length - missingTechnicalRoles.length) / requiredTechnicalRoles.length) * 100)
        ),
        shotsCount,
        consistencyWarnings,
      };
    });
  }, [locations, allShots, technicalCrewPool, projectContext?.budget]);

  const locationMetricsById = useMemo<Record<string, LocationProMetrics>>(
    () =>
      locationProMetrics.reduce<Record<string, LocationProMetrics>>((acc, metric) => {
        acc[metric.locationId] = metric;
        return acc;
      }, {}),
    [locationProMetrics]
  );

  const proFilteredAndSortedLocations = useMemo(() => {
    const base = [...filteredAndSortedLocations];
    const avgBudgetPerLocation =
      typeof projectContext?.budget === 'number' && projectContext.budget > 0 && base.length > 0
        ? projectContext.budget / base.length
        : null;

    const presetFiltered = base.filter((location) => {
      const metric = locationMetricsById[location.id];
      if (!metric) return true;
      if (proPreset === 'tech_scout') {
        return Boolean(location.coordinates) || metric.shotsCount > 0 || location.type === 'outdoor';
      }
      if (proPreset === 'permits') {
        return metric.permitMissing || metric.hasPermitEvidence;
      }
      if (proPreset === 'night_shoot') {
        const text = `${String(location.name)} ${String(location.notes ?? '')} ${String(location.address ?? '')}`.toLowerCase();
        return /(night|natt|kveld|mork|mørk)/i.test(text) || location.type === 'studio';
      }
      if (proPreset === 'low_budget') {
        return avgBudgetPerLocation ? metric.estimatedCost <= avgBudgetPerLocation * 1.1 : metric.estimatedCost <= 12000;
      }
      return true;
    });

    return presetFiltered.filter((location) => {
      const metric = locationMetricsById[location.id];
      if (!metric) return true;
      switch (operationalFilter) {
        case 'ready_today':
          return metric.readinessScore >= 80 && metric.riskLevel !== 'hoy';
        case 'permit_missing':
          return metric.permitMissing;
        case 'high_risk':
          return metric.riskLevel === 'hoy';
        case 'over_budget':
          return metric.overBudget;
        case 'with_shots':
          return metric.shotsCount > 0;
        default:
          return true;
      }
    });
  }, [filteredAndSortedLocations, locationMetricsById, proPreset, operationalFilter, projectContext?.budget]);

  const proVisibleLocations = useMemo(
    () => proFilteredAndSortedLocations.slice(0, proPageSize),
    [proFilteredAndSortedLocations, proPageSize]
  );

  const operationalStats = useMemo(() => {
    const source = proFilteredAndSortedLocations;
    const readyToday = source.filter((location) => (locationMetricsById[location.id]?.readinessScore ?? 0) >= 80).length;
    const permitMissing = source.filter((location) => locationMetricsById[location.id]?.permitMissing).length;
    const highRisk = source.filter((location) => locationMetricsById[location.id]?.riskLevel === 'hoy').length;
    const overBudget = source.filter((location) => locationMetricsById[location.id]?.overBudget).length;
    const withShots = source.filter((location) => (locationMetricsById[location.id]?.shotsCount ?? 0) > 0).length;
    return {
      total: source.length,
      readyToday,
      permitMissing,
      highRisk,
      overBudget,
      withShots,
    };
  }, [proFilteredAndSortedLocations, locationMetricsById]);

  const consistencyFindings = useMemo<ConsistencyFinding[]>(() => {
    return locationProMetrics.flatMap((metric) =>
      metric.consistencyWarnings.map((warning) => {
        const targetSection = getConsistencyTargetSection(warning);
        return {
          locationId: metric.locationId,
          warning,
          targetSection,
          ctaLabel: getConsistencyCtaLabel(targetSection),
        };
      })
    );
  }, [locationProMetrics]);

  const mapLocations = useMemo<ProMapLocation[]>(() => {
    return proFilteredAndSortedLocations
      .filter((location) => typeof location.coordinates?.lat === 'number' && typeof location.coordinates?.lng === 'number')
      .map((location) => ({
        locationId: location.id,
        lat: location.coordinates!.lat,
        lng: location.coordinates!.lng,
        typeColor: getTypeColor(location.type),
        name: location.name,
      }));
  }, [proFilteredAndSortedLocations]);

  const mapBounds = useMemo<Array<[number, number]>>(
    () => mapLocations.map((location) => [location.lat, location.lng]),
    [mapLocations]
  );

  const activeMapLocation = useMemo<ProMapLocation | null>(
    () => mapLocations.find((location) => location.locationId === activeMapLocationId) ?? mapLocations[0] ?? null,
    [mapLocations, activeMapLocationId]
  );

  const activeMapExternalUrl = useMemo(() => {
    if (!activeMapLocation) return null;
    return `https://www.openstreetmap.org/?mlat=${activeMapLocation.lat.toFixed(6)}&mlon=${activeMapLocation.lng.toFixed(6)}#map=13/${activeMapLocation.lat.toFixed(6)}/${activeMapLocation.lng.toFixed(6)}`;
  }, [activeMapLocation]);

  useEffect(() => {
    if (mapLocations.length === 0) {
      setActiveMapLocationId(null);
      return;
    }
    if (!activeMapLocationId || !mapLocations.some((location) => location.locationId === activeMapLocationId)) {
      setActiveMapLocationId(mapLocations[0].locationId);
    }
  }, [mapLocations, activeMapLocationId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true');

      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleOpenDialog();
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        handleExportCSV();
      }
      if (!isTextInput && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setLocationGuideOpen(true);
      }
      if (e.key === 'Escape' && locationGuideOpen) {
        e.preventDefault();
        setLocationGuideOpen(false);
      }
      if (e.key === 'Escape' && dialogOpen) {
        handleCloseDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, locationGuideOpen]);

  // Handlers
  const handleOpenDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      setFormData(location);
    } else {
      setEditingLocation(null);
      setFormData({
        name: '',
        address: '',
        type: 'indoor',
        capacity: undefined,
        facilities: [],
        availability: {},
        assignedScenes: [],
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!externalCreateSignal || externalCreateSignal === externalCreateSignalRef.current) {
      return;
    }
    externalCreateSignalRef.current = externalCreateSignal;
    externalCreatePendingRef.current = true;
    handleOpenDialog();
  }, [externalCreateSignal]);

  const handleCloseDialog = () => {
    if (externalCreatePendingRef.current) {
      externalCreatePendingRef.current = false;
      onExternalCreateCancelled?.();
    }
    setDialogOpen(false);
    setEditingLocation(null);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showError('Navn er påkrevd');
      return;
    }

    // Sørg for REELLE koordinater: hvis adresse er satt men koordinater mangler
    // (eller er 0,0), geokod via Kartverket (autoritativ). Uten koordinater
    // virker ikke vær, reiseavstand, kart og call-sheets — så vi varsler.
    const hasRealCoords = (c?: { lat: number; lng: number } | null): boolean =>
      !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && !(c.lat === 0 && c.lng === 0);
    let resolvedCoordinates = formData.coordinates;
    let resolvedAddress = formData.address;
    let resolvedPropertyId = formData.propertyId;
    if (!hasRealCoords(resolvedCoordinates) && formData.address?.trim()) {
      try {
        const geo = await externalDataService.getKartverketAddress(formData.address.trim());
        if (geo?.coordinates && hasRealCoords(geo.coordinates)) {
          resolvedCoordinates = geo.coordinates;
          resolvedAddress = geo.address || resolvedAddress;
          resolvedPropertyId = geo.propertyId || resolvedPropertyId;
        }
      } catch {
        /* best-effort — varsles under hvis fortsatt uten koordinater */
      }
    }
    if (!hasRealCoords(resolvedCoordinates)) {
      showWarning(
        formData.address?.trim()
          ? 'Adressen kunne ikke geokodes — lokasjonen lagres uten verifiserte koordinater. Vær, reiseavstand og kart vil ikke fungere før adressen rettes.'
          : 'Lokasjonen lagres uten adresse/koordinater. Legg til en adresse for vær, reiseavstand, kart og call-sheets.',
      );
    }

    try {
      const isCreating = !editingLocation;
      const nowIso = new Date().toISOString();
      const notesText = typeof formData.notes === 'string' ? formData.notes.trim() : '';
      const location: Location = editingLocation
        ? {
            ...editingLocation,
            ...formData,
            // Geokodede verdier overstyrer (ekte koordinater fra Kartverket).
            address: resolvedAddress,
            coordinates: resolvedCoordinates,
            propertyId: resolvedPropertyId,
            ...(notesText
              ? {
                  notesAuthorName: noteActorLabel,
                  notesAuthorId: noteActorId,
                  notesUpdatedAt: nowIso,
                }
              : {}),
            updatedAt: nowIso,
          }
        : {
            id: `location-${Date.now()}`,
            name: formData.name || '',
            address: resolvedAddress || '',
            type: formData.type || 'indoor',
            capacity: formData.capacity,
            facilities: formData.facilities || [],
            availability: formData.availability || {},
            assignedScenes: formData.assignedScenes || [],
            contactInfo: formData.contactInfo,
            notes: formData.notes,
            coordinates: resolvedCoordinates,
            propertyId: resolvedPropertyId,
            ...(notesText
              ? {
                  notesAuthorName: noteActorLabel,
                  notesAuthorId: noteActorId,
                  notesUpdatedAt: nowIso,
                }
              : {}),
            createdAt: nowIso,
            updatedAt: nowIso,
          };

      await castingService.saveLocation(projectId, location);
      const mentionSeed = [
        formData.name,
        formData.contactInfo?.name,
        ...globalTagService.parseExplicitMentions(typeof formData.notes === 'string' ? formData.notes : ''),
      ]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length >= 2);
      if (mentionSeed.length > 0) {
        void globalTagService.add(mentionSeed).catch((error) => {
          console.warn('Kunne ikke oppdatere globalt mention-register for lokasjoner:', error);
        });
      }
      const locs = await castingService.getLocations(projectId);
      setLocations(Array.isArray(locs) ? locs : []);

      // Show success notification
      if (editingLocation) {
        showSuccess(`${formData.name} oppdatert`, 3000);
      } else {
        showSuccess(`${formData.name} lagt til`, 3000);
        roleRoomAnalytics.locationAdded({
          project_id: projectId,
          location_id: location.id,
          source: 'manual',
        });
      }

      if (isCreating) {
        externalCreatePendingRef.current = false;
        onExternalCreated?.(location);
      }

      handleCloseDialog();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving location:', error);
      showError('Feil ved lagring av lokasjon');
    }
  };

  const handleDeleteWithUndo = async (locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    if (location) {
      try {
        setDeletedLocation(location);
        await castingService.deleteLocation(projectId, locationId);
        const locs = await castingService.getLocations(projectId);
        setLocations(Array.isArray(locs) ? locs : []);
        setUndoSnackbarOpen(true);
        showInfo(`${location.name} slettet - klikk "Angre" for å gjenopprette`, 6000);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting location:', error);
        showError('Feil ved sletting av lokasjon');
      }
    }
  };

  const handleUndoDelete = async () => {
    if (deletedLocation) {
      try {
        await castingService.saveLocation(projectId, deletedLocation);
        const locs = await castingService.getLocations(projectId);
        setLocations(Array.isArray(locs) ? locs : []);
        showSuccess(`${deletedLocation.name} gjenopprettet`, 3000);
        setDeletedLocation(null);
        setUndoSnackbarOpen(false);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error undoing delete:', error);
        showError('Feil ved gjenoppretting av lokasjon');
      }
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
  };

  const handleCopyAddress = async (address: string, id: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedLocations.map((l) => l.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Er du sikker på at du vil slette \${selectedIds.size} lokasjon(er)?`)) {
      try {
        for (const id of selectedIds) {
          await castingService.deleteLocation(projectId, id);
        }
        const locs = await castingService.getLocations(projectId);
        setLocations(Array.isArray(locs) ? locs : []);
        setSelectedIds(new Set());
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting locations:', error);
        showError('Feil ved sletting av lokasjoner');
      }
    }
  };

  const handleDuplicate = async (location: Location) => {
    try {
      const newLocation: Location = {
        ...location,
        id: `location-\${Date.now()}`,
        name: `\${location.name} (kopi)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveLocation(projectId, newLocation);
      const locs = await castingService.getLocations(projectId);
      setLocations(Array.isArray(locs) ? locs : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error duplicating location:', error);
      showError('Feil ved duplisering av lokasjon');
    }
  };

  const handleExportCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        alert('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateLocationsHTML(project, locations);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Kunne ikke åpne eksport-vindu. Vennligst tillat popups.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error exporting locations:', error);
      alert('Kunne ikke eksportere lokasjoner');
    }
  };

  const applySavedProView = (view: SavedLocationProView) => {
    setSelectedProViewId(view.id);
    setProPreset(view.preset);
    setOperationalFilter(view.operationalFilter);
    setSearchQuery(view.searchQuery);
    setFilterType(view.filterType);
    setSortField(view.sortField);
    setSortDirection(view.sortDirection);
    setProViewName(view.name);
    setViewMode('pro');
  };

  const handleSaveCurrentProView = () => {
    const trimmedName = proViewName.trim();
    if (!trimmedName) {
      showError('Gi visningen et navn før lagring');
      return;
    }

    const view: SavedLocationProView = {
      id: selectedProViewId !== 'custom' ? selectedProViewId : `pro-view-${Date.now()}`,
      name: trimmedName,
      preset: proPreset,
      operationalFilter,
      searchQuery,
      filterType,
      sortField,
      sortDirection,
    };

    setSavedProViews((prev) => {
      const withoutCurrent = prev.filter((existing) => existing.id !== view.id);
      return [view, ...withoutCurrent].slice(0, 12);
    });
    setSelectedProViewId(view.id);
    showSuccess(`Visning "${trimmedName}" lagret`, 2500);
  };

  const handleDeleteSavedProView = () => {
    if (selectedProViewId === 'custom') return;
    const target = savedProViews.find((view) => view.id === selectedProViewId);
    if (!target) return;
    setSavedProViews((prev) => prev.filter((view) => view.id !== selectedProViewId));
    setSelectedProViewId('custom');
    setProViewName('');
    showInfo(`Visning "${target.name}" slettet`, 2500);
  };

  const handleBulkSetWorkflowStatus = async () => {
    if (selectedIds.size === 0) {
      showInfo('Velg minst én lokasjon for statusoppdatering', 2500);
      return;
    }
    try {
      const targets = locations.filter((location) => selectedIds.has(location.id));
      await Promise.all(
        targets.map((location) =>
          castingService.saveLocation(projectId, {
            ...location,
            workflowStatus: bulkWorkflowStatus,
            updatedAt: new Date().toISOString(),
          } as Location)
        )
      );
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      showSuccess(`Status satt til "${bulkWorkflowStatus}" for ${targets.length} lokasjoner`, 3000);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error bulk updating workflow status:', error);
      showError('Kunne ikke oppdatere status for valgte lokasjoner');
    }
  };

  const handleBulkAssignTechnicalTeam = async () => {
    if (selectedIds.size === 0) {
      showInfo('Velg minst én lokasjon for å tildele teknisk team', 2500);
      return;
    }
    try {
      const technicalRoles = technicalCrewPool.map((member) => String(member.role)).filter(Boolean);
      const targets = locations.filter((location) => selectedIds.has(location.id));
      await Promise.all(
        targets.map((location) =>
          castingService.saveLocation(projectId, {
            ...location,
            technicalTeamAssigned: true,
            technicalTeamRoles: technicalRoles,
            technicalTeamAssignedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Location)
        )
      );
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      showSuccess(`Teknisk team tildelt til ${targets.length} lokasjoner`, 3000);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error bulk assigning technical team:', error);
      showError('Kunne ikke tildele teknisk team');
    }
  };

  const handleBulkCopyFacilitiesFromActive = async () => {
    const sourceId = activeMapLocationId || [...selectedIds][0];
    if (!sourceId) {
      showInfo('Velg en aktiv lokasjon først', 2500);
      return;
    }
    if (selectedIds.size <= 1) {
      showInfo('Velg flere lokasjoner for å kopiere tags/fasiliteter', 2500);
      return;
    }
    const source = locations.find((location) => location.id === sourceId);
    if (!source || !Array.isArray(source.facilities) || source.facilities.length === 0) {
      showError('Aktiv lokasjon har ingen fasiliteter å kopiere');
      return;
    }
    const sourceFacilities = normalizeLocationFacilities(source.facilities);
    if (sourceFacilities.length === 0) {
      showError('Aktiv lokasjon har ingen fasiliteter å kopiere');
      return;
    }
    try {
      const targets = locations.filter((location) => selectedIds.has(location.id) && location.id !== sourceId);
      await Promise.all(
        targets.map((location) =>
          castingService.saveLocation(projectId, {
            ...location,
            facilities: [...sourceFacilities],
            updatedAt: new Date().toISOString(),
          } as Location)
        )
      );
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      showSuccess(`Kopierte fasiliteter til ${targets.length} lokasjoner`, 3000);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error bulk copying facilities:', error);
      showError('Kunne ikke kopiere fasiliteter');
    }
  };

  const handleExportSelectedCallSheet = async () => {
    if (selectedIds.size === 0) {
      showInfo('Velg lokasjoner før eksport av call sheet', 2500);
      return;
    }
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        showError('Prosjekt ikke funnet');
        return;
      }
      const selectedLocations = locations.filter((location) => selectedIds.has(location.id));
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showError('Kunne ikke åpne eksport-vindu. Tillat popups.');
        return;
      }
      const htmlContent = generateLocationsHTML(
        {
          ...project,
          name: `${project.name} • Call sheet (lokasjoner)`,
        },
        selectedLocations
      );
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error exporting selected location call sheet:', error);
      showError('Kunne ikke eksportere valgte lokasjoner');
    }
  };

  const handleNormalizeAnnotationColors = async () => {
    const candidates = locations.filter((location) => {
      const annotationColor = String((location as any).annotationColor ?? '').toLowerCase();
      return annotationColor && !APPROVED_ANNOTATION_COLORS.has(annotationColor);
    });
    if (candidates.length === 0) {
      showInfo('Ingen avvikende annoteringsfarger funnet', 2500);
      return;
    }
    try {
      await Promise.all(
        candidates.map((location) =>
          castingService.saveLocation(projectId, {
            ...location,
            annotationColor: getTypeColor(location.type),
            updatedAt: new Date().toISOString(),
          } as Location)
        )
      );
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      showSuccess(`Standardiserte annoteringsfarger for ${candidates.length} lokasjoner`, 3000);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error normalizing annotation colors:', error);
      showError('Kunne ikke standardisere annoteringsfarger');
    }
  };

  const generateLocationsHTML = (project: any, locations: any[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalLocations = locations.length;
    const locationsWithScenes = locations.filter(loc => loc.assignedScenes.length > 0).length;

    const locationIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Lokasjoner</title>
  <style>
    @page { margin: 0; counter-increment: page; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.7; padding: 0; background: #fff; font-size: 14px; }
    .page { padding: 50px 60px 80px 60px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #a855f7; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #a855f7; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #a855f7; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #a855f7; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #a855f7; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #a855f7 0%, #6d28d9 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    td { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 400; vertical-align: top; }
    td small { display: block; margin-top: 4px; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 15px 60px; border-top: 2px solid #e2e8f0; background: #fafbfc; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; font-weight: 500; }
    .footer-left { display: flex; gap: 20px; }
    .footer-right { display: flex; gap: 20px; }
    .page-number { font-weight: 600; }
    .page-number::after { content: counter(page); }
    .empty-state { padding: 50px; text-align: center; color: #94a3b8; font-style: italic; font-size: 15px; }
    @media print {
      .page { padding: 30px 40px 70px 40px; }
      .section { page-break-inside: avoid; margin-bottom: 35px; }
      .summary { page-break-inside: avoid; }
      .footer { padding: 12px 40px; }
      .header { margin: -30px -40px 35px -40px; padding: 25px 30px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">
        ${locationIconSVG}
        ${project.name} - Lokasjoner
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${locationIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalLocations}</span>
          <span class="summary-label">Totale Lokasjoner</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${locationsWithScenes}</span>
          <span class="summary-label">Med Tildelte Scener</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${locationIconSVG}</span>
          Lokasjoner
        </div>
        <span class="section-count">${totalLocations} lokasjon${totalLocations !== 1 ? 'er' : ''}</span>
      </div>
      <div class="section-content">
        ${locations.length === 0
          ? '<div class="empty-state">Ingen lokasjoner ennå</div>'
          : `<table>
          <thead>
            <tr>
              <th style="width: 20%;">Navn</th>
              <th style="width: 12%;">Type</th>
              <th style="width: 25%;">Adresse</th>
              <th style="width: 10%;">Kapasitet</th>
              <th style="width: 20%;">Fasiliteter</th>
              <th style="width: 8%;">Scener</th>
              <th style="width: 5%;">Notater</th>
            </tr>
          </thead>
          <tbody>
            ${locations.map((loc) => {
              const facilities = (loc.facilities || []).map(getFacilityLabel).join(', ') || '-';
              const notes = loc.notes || '-';
              const contactInfo = loc.contactInfo ? 
                (loc.contactInfo.name ? `Kontakt: ${loc.contactInfo.name}` : '') +
                (loc.contactInfo.phone ? (loc.contactInfo.name ? ' | ' : '') + `Tel: ${loc.contactInfo.phone}` : '') +
                (loc.contactInfo.email ? (loc.contactInfo.name || loc.contactInfo.phone ? ' | ' : '') + `E-post: ${loc.contactInfo.email}` : '')
                : '';
              const addressWithContact = contactInfo ? `${loc.address || '-'}<br><small style="color: #64748b;">${contactInfo}</small>` : (loc.address || '-');
              return `<tr>
              <td><strong>${loc.name}</strong></td>
              <td>${getTypeLabel(loc.type)}</td>
              <td>${addressWithContact}</td>
              <td>${loc.capacity?.toString() || '-'}</td>
              <td style="font-size: 13px;">${facilities}</td>
              <td style="text-align: center;">${loc.assignedScenes.length}</td>
              <td style="font-size: 13px;">${notes.length > 50 ? notes.substring(0, 50) + '...' : notes}</td>
            </tr>`;
            }).join('')}
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
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const getProSectionState = (locationId: string): ProSectionState => ({
    ...DEFAULT_PRO_SECTION_STATE,
    ...(proSectionStates[locationId] ?? {}),
  });

  const toggleProSection = (locationId: string, section: ProSectionKey) => {
    setProSectionStates((prev) => {
      const current = {
        ...DEFAULT_PRO_SECTION_STATE,
        ...(prev[locationId] ?? {}),
      };
      return {
        ...prev,
        [locationId]: {
          ...current,
          [section]: !current[section],
        },
      };
    });
  };

  const handleGoToConsistencyFinding = (finding: ConsistencyFinding) => {
    const totalLocations = Math.max(locations.length, 24);
    const locationForFinding = locations.find((location) => location.id === finding.locationId);
    const expandedAll: ProSectionState = {
      summary: true,
      loadFlow: true,
      sceneLinks: true,
      media: true,
      contact: true,
    };
    const applyConsistencyTarget = (openSummaryEditor: boolean) => {
      setConsistencyIndicator({
        locationId: finding.locationId,
        section: finding.targetSection,
        activatedAt: Date.now(),
      });
      setProSectionStates((prev) => ({
        ...prev,
        [finding.locationId]: expandedAll,
      }));
      if (!locationForFinding) return;
      if (finding.targetSection === 'summary') {
        if (openSummaryEditor) {
          handleOpenDialog(locationForFinding);
        }
      } else if (finding.targetSection === 'loadFlow') {
        setLoadFlowDrafts((prev) => {
          if (prev[locationForFinding.id]) return prev;
          return {
            ...prev,
            [locationForFinding.id]: buildProLoadFlowDraft(locationForFinding),
          };
        });
        setEditingLoadFlowIds((prev) => {
          const next = new Set(prev);
          next.add(finding.locationId);
          return next;
        });
      } else if (finding.targetSection === 'sceneLinks') {
        setSceneLinkDrafts((prev) => {
          if (prev[locationForFinding.id]) return prev;
          return {
            ...prev,
            [locationForFinding.id]: normalizeSceneIds(locationForFinding.assignedScenes),
          };
        });
        setEditingSceneLinkIds((prev) => {
          const next = new Set(prev);
          next.add(finding.locationId);
          return next;
        });
      } else if (finding.targetSection === 'media') {
        setMediaDrafts((prev) => {
          if (prev[locationForFinding.id]) return prev;
          return {
            ...prev,
            [locationForFinding.id]: buildProMediaDraft(locationForFinding),
          };
        });
        setEditingMediaIds((prev) => {
          const next = new Set(prev);
          next.add(finding.locationId);
          return next;
        });
      } else if (finding.targetSection === 'contact') {
        setProContactDrafts((prev) => {
          if (prev[locationForFinding.id]) return prev;
          return {
            ...prev,
            [locationForFinding.id]: buildProContactDraft(locationForFinding),
          };
        });
        setEditingProContactIds((prev) => {
          const next = new Set(prev);
          next.add(finding.locationId);
          return next;
        });
      }
    };
    setViewMode('pro');
    setSelectedProViewId('custom');
    setProPreset('all');
    setOperationalFilter('all');
    setSearchQuery('');
    setFilterType('all');
    setSortField('name');
    setSortDirection('asc');
    setProPageSize((current) => Math.max(current, totalLocations));
    setActiveMapLocationId(finding.locationId);
    applyConsistencyTarget(true);

    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        applyConsistencyTarget(false);
        const targetElement = document.getElementById(`location-pro-card-${finding.locationId}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    });
  };

  const handleFacilityToggle = (facility: string) => {
    const currentFacilities = formData.facilities || [];
    const newFacilities = currentFacilities.includes(facility)
      ? currentFacilities.filter((f) => f !== facility)
      : [...currentFacilities, facility];
    setFormData({ ...formData, facilities: newFacilities });
  };

  const handleValidateAddress = async () => {
    if (!formData.address?.trim()) {
      showError('Adresse er påkrevd for validering');
      return;
    }

    setValidatingAddress(true);
    try {
      const addressData = await externalDataService.getKartverketAddress(formData.address);
      if (addressData.coordinates && addressData.address) {
        setFormData({
          ...formData,
          address: addressData.address,
          coordinates: addressData.coordinates,
          propertyId: addressData.propertyId,
        });
        showSuccess(`Adresse validert: ${addressData.address}`);
      } else if (addressData.coordinates) {
        setFormData({
          ...formData,
          coordinates: addressData.coordinates,
          propertyId: addressData.propertyId,
        });
        showSuccess('Koordinater funnet, men adressen kunne ikke bekreftes fullstendig');
      } else {
        showError('Adressen ble ikke funnet. Sjekk at den er riktig skrevet.');
      }
    } catch (error) {
      console.error('Address validation failed:', error);
      showError('Kunne ikke validere adresse. Prøv igjen senere.');
    } finally {
      setValidatingAddress(false);
    }
  };

  const handleOpenAnalysisDialog = (location: Location) => {
    setSelectedLocationForAnalysis(location);
    setAnalysisDialogOpen(true);
  };

  const handleAnalysisComplete = async (analysis: Location['propertyAnalysis']) => {
    if (selectedLocationForAnalysis) {
      try {
        const updatedLocation: Location = {
          ...selectedLocationForAnalysis,
          propertyAnalysis: analysis,
          updatedAt: new Date().toISOString(),
        };
        await castingService.saveLocation(projectId, updatedLocation);
        const locs = await castingService.getLocations(projectId);
        setLocations(Array.isArray(locs) ? locs : []);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error saving location analysis:', error);
        showError('Feil ved lagring av analyse');
      }
    }
  };

  const handleToggleProContactEditing = (location: Location) => {
    setProSectionStates((prev) => ({
      ...prev,
      [location.id]: {
        ...DEFAULT_PRO_SECTION_STATE,
        ...(prev[location.id] ?? {}),
        contact: true,
      },
    }));
    setProContactDrafts((prev) => {
      if (prev[location.id]) return prev;
      return {
        ...prev,
        [location.id]: buildProContactDraft(location),
      };
    });
    setEditingProContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(location.id)) {
        next.delete(location.id);
      } else {
        next.add(location.id);
      }
      return next;
    });
  };

  const handleProContactDraftChange = (
    locationId: string,
    field: keyof ProContactDraft,
    value: string
  ) => {
    setProContactDrafts((prev) => ({
      ...prev,
      [locationId]: {
        ...(prev[locationId] ?? { name: '', phone: '', email: '' }),
        [field]: value,
      },
    }));
  };

  const handleCancelProContactEditing = (location: Location) => {
    setEditingProContactIds((prev) => {
      const next = new Set(prev);
      next.delete(location.id);
      return next;
    });
    setProContactDrafts((prev) => {
      const next = { ...prev };
      delete next[location.id];
      return next;
    });
  };

  const handleSaveProContact = async (location: Location) => {
    if (savingProContactIds.has(location.id)) return;
    const draft = proContactDrafts[location.id] ?? buildProContactDraft(location);
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    const email = draft.email.trim();

    const existingContactInfo = (location.contactInfo ?? {}) as Record<string, unknown>;
    const previousName = typeof existingContactInfo.name === 'string' ? existingContactInfo.name.trim() : '';
    const previousPhone = typeof existingContactInfo.phone === 'string' ? existingContactInfo.phone.trim() : '';
    const previousEmail = typeof existingContactInfo.email === 'string' ? existingContactInfo.email.trim() : '';

    if (name === previousName && phone === previousPhone && email === previousEmail) {
      setEditingProContactIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
      showInfo('Ingen endringer i kontaktinfo', 2200);
      return;
    }

    const { name: _oldName, phone: _oldPhone, email: _oldEmail, ...rest } = existingContactInfo;
    const nextContactInfo: Record<string, unknown> = { ...rest };
    if (name) nextContactInfo.name = name;
    if (phone) nextContactInfo.phone = phone;
    if (email) nextContactInfo.email = email;

    const updatedLocation: Location = {
      ...location,
      contactInfo: Object.keys(nextContactInfo).length > 0 ? nextContactInfo : undefined,
      updatedAt: new Date().toISOString(),
    };

    setSavingProContactIds((prev) => {
      const next = new Set(prev);
      next.add(location.id);
      return next;
    });

    try {
      await castingService.saveLocation(projectId, updatedLocation);
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      setEditingProContactIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
      setProContactDrafts((prev) => {
        const next = { ...prev };
        delete next[location.id];
        return next;
      });
      showSuccess(`Kontaktinfo oppdatert for ${location.name}`, 2600);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating pro contact info:', error);
      showError('Kunne ikke oppdatere kontaktinfo');
    } finally {
      setSavingProContactIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
    }
  };

  const handleToggleBasecamp = async (location: Location) => {
    if (savingBasecampIds.has(location.id)) return;
    const current = Boolean((location as any).isBasecamp);
    setSavingBasecampIds((prev) => new Set(prev).add(location.id));
    try {
      await castingService.saveLocation(projectId, {
        ...location,
        isBasecamp: !current,
        updatedAt: new Date().toISOString(),
      } as Location);
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      showSuccess(!current ? `Basecamp aktivert for ${location.name}` : `Basecamp fjernet for ${location.name}`, 2400);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error toggling basecamp:', error);
      showError('Kunne ikke oppdatere basecamp-markering');
    } finally {
      setSavingBasecampIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
    }
  };

  const handleToggleLoadFlowEditing = (location: Location) => {
    setProSectionStates((prev) => ({
      ...prev,
      [location.id]: {
        ...DEFAULT_PRO_SECTION_STATE,
        ...(prev[location.id] ?? {}),
        loadFlow: true,
      },
    }));
    setLoadFlowDrafts((prev) => {
      if (prev[location.id]) return prev;
      return {
        ...prev,
        [location.id]: buildProLoadFlowDraft(location),
      };
    });
    setEditingLoadFlowIds((prev) => {
      const next = new Set(prev);
      if (next.has(location.id)) {
        next.delete(location.id);
      } else {
        next.add(location.id);
      }
      return next;
    });
  };

  const handleLoadFlowDraftChange = (
    locationId: string,
    field: keyof ProLoadFlowDraft,
    value: string
  ) => {
    setLoadFlowDrafts((prev) => ({
      ...prev,
      [locationId]: {
        ...(prev[locationId] ?? {
          loadInAt: '',
          shootStartAt: '',
          wrapAt: '',
          loadOutAt: '',
          status: 'planned' as LoadFlowStatus,
          notes: '',
        }),
        [field]: value,
      },
    }));
  };

  const handleCancelLoadFlowEditing = (location: Location) => {
    setEditingLoadFlowIds((prev) => {
      const next = new Set(prev);
      next.delete(location.id);
      return next;
    });
    setLoadFlowDrafts((prev) => {
      const next = { ...prev };
      delete next[location.id];
      return next;
    });
  };

  const handleSaveLoadFlow = async (location: Location) => {
    if (savingLoadFlowIds.has(location.id)) return;
    const draft = loadFlowDrafts[location.id] ?? buildProLoadFlowDraft(location);
    const toPersist = {
      loadInAt: toIsoOrRawDateTime(draft.loadInAt),
      shootStartAt: toIsoOrRawDateTime(draft.shootStartAt),
      wrapAt: toIsoOrRawDateTime(draft.wrapAt),
      loadOutAt: toIsoOrRawDateTime(draft.loadOutAt),
      status: draft.status,
      notes: draft.notes.trim() || undefined,
    };
    const hasAnyValue = Object.values(toPersist).some((value) => value !== undefined && value !== '');
    setSavingLoadFlowIds((prev) => new Set(prev).add(location.id));
    try {
      await castingService.saveLocation(projectId, {
        ...location,
        loadFlow: hasAnyValue ? toPersist : undefined,
        updatedAt: new Date().toISOString(),
      } as Location);
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      setEditingLoadFlowIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
      setLoadFlowDrafts((prev) => {
        const next = { ...prev };
        delete next[location.id];
        return next;
      });
      showSuccess(`Load-in / load-out oppdatert for ${location.name}`, 2600);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating load flow:', error);
      showError('Kunne ikke oppdatere load-in/load-out flyt');
    } finally {
      setSavingLoadFlowIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
    }
  };

  const handleToggleSceneLinkEditing = (location: Location) => {
    setProSectionStates((prev) => ({
      ...prev,
      [location.id]: {
        ...DEFAULT_PRO_SECTION_STATE,
        ...(prev[location.id] ?? {}),
        sceneLinks: true,
      },
    }));
    setSceneLinkDrafts((prev) => {
      if (prev[location.id]) return prev;
      return {
        ...prev,
        [location.id]: normalizeSceneIds(location.assignedScenes),
      };
    });
    setEditingSceneLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(location.id)) {
        next.delete(location.id);
      } else {
        next.add(location.id);
      }
      return next;
    });
  };

  const handleToggleSceneLink = (locationId: string, sceneId: string) => {
    setSceneLinkDrafts((prev) => {
      const existing = new Set(prev[locationId] ?? []);
      if (existing.has(sceneId)) {
        existing.delete(sceneId);
      } else {
        existing.add(sceneId);
      }
      return {
        ...prev,
        [locationId]: Array.from(existing),
      };
    });
  };

  const handleCancelSceneLinkEditing = (location: Location) => {
    setEditingSceneLinkIds((prev) => {
      const next = new Set(prev);
      next.delete(location.id);
      return next;
    });
    setSceneLinkDrafts((prev) => {
      const next = { ...prev };
      delete next[location.id];
      return next;
    });
  };

  const handleSaveSceneLinks = async (location: Location) => {
    if (savingSceneLinkIds.has(location.id)) return;
    const nextSceneIds = normalizeSceneIds(sceneLinkDrafts[location.id] ?? location.assignedScenes);
    const previousSceneIds = normalizeSceneIds(location.assignedScenes);
    const hasChanged =
      nextSceneIds.length !== previousSceneIds.length ||
      nextSceneIds.some((sceneId) => !previousSceneIds.includes(sceneId));
    if (!hasChanged) {
      setEditingSceneLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
      showInfo('Ingen endring i scene-kobling', 2200);
      return;
    }
    setSavingSceneLinkIds((prev) => new Set(prev).add(location.id));
    try {
      await castingService.saveLocation(projectId, {
        ...location,
        assignedScenes: nextSceneIds,
        updatedAt: new Date().toISOString(),
      } as Location);
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      setEditingSceneLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
      setSceneLinkDrafts((prev) => {
        const next = { ...prev };
        delete next[location.id];
        return next;
      });
      showSuccess(`Scene-kobling oppdatert for ${location.name}`, 2600);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating scene links:', error);
      showError('Kunne ikke oppdatere scene-koblinger');
    } finally {
      setSavingSceneLinkIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
    }
  };

  const handleToggleMediaEditing = (location: Location) => {
    setProSectionStates((prev) => ({
      ...prev,
      [location.id]: {
        ...DEFAULT_PRO_SECTION_STATE,
        ...(prev[location.id] ?? {}),
        media: true,
      },
    }));
    setMediaDrafts((prev) => {
      if (prev[location.id]) return prev;
      return {
        ...prev,
        [location.id]: buildProMediaDraft(location),
      };
    });
    setEditingMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(location.id)) {
        next.delete(location.id);
      } else {
        next.add(location.id);
      }
      return next;
    });
  };

  const handleCancelMediaEditing = (location: Location) => {
    setEditingMediaIds((prev) => {
      const next = new Set(prev);
      next.delete(location.id);
      return next;
    });
    setMediaDrafts((prev) => {
      const next = { ...prev };
      delete next[location.id];
      return next;
    });
  };

  const handleMediaDraftFieldChange = (
    locationId: string,
    field: keyof ProMediaDraft,
    value: string | string[] | ProMediaAsset[]
  ) => {
    setMediaDrafts((prev) => ({
      ...prev,
      [locationId]: {
        ...(prev[locationId] ?? {
          locationImages: [],
          storyboardImages: [],
          locationImageUrlInput: '',
          locationImageCaptionInput: '',
          storyboardImageUrlInput: '',
          storyboardImageCaptionInput: '',
          storyboardSceneIds: [],
        }),
        [field]: value as never,
      },
    }));
  };

  const handleAddMediaFromUrl = (locationId: string, type: 'location' | 'storyboard') => {
    const draft = mediaDrafts[locationId];
    if (!draft) return;
    const url =
      type === 'location' ? draft.locationImageUrlInput.trim() : draft.storyboardImageUrlInput.trim();
    const caption =
      type === 'location' ? draft.locationImageCaptionInput : draft.storyboardImageCaptionInput;
    if (!url) {
      showInfo('Legg inn en gyldig URL først', 2200);
      return;
    }
    const targetList = type === 'location' ? draft.locationImages : draft.storyboardImages;
    if (targetList.some((asset) => asset.url === url)) {
      showInfo('Bildet er allerede lagt til', 2200);
      return;
    }
    const asset = buildProMediaAsset(
      url,
      caption,
      type === 'storyboard' ? draft.storyboardSceneIds : [],
      'url'
    );
    if (type === 'location') {
      handleMediaDraftFieldChange(locationId, 'locationImages', [...draft.locationImages, asset]);
      handleMediaDraftFieldChange(locationId, 'locationImageUrlInput', '');
      handleMediaDraftFieldChange(locationId, 'locationImageCaptionInput', '');
    } else {
      handleMediaDraftFieldChange(locationId, 'storyboardImages', [...draft.storyboardImages, asset]);
      handleMediaDraftFieldChange(locationId, 'storyboardImageUrlInput', '');
      handleMediaDraftFieldChange(locationId, 'storyboardImageCaptionInput', '');
    }
  };

  const handleAddMediaFromFile = async (
    locationId: string,
    type: 'location' | 'storyboard',
    file: File
  ) => {
    if (!file.type.startsWith('image/')) {
      showError('Kun bilde-filer støttes her');
      return;
    }
    if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
      showError('Filen er for stor (maks 8MB)');
      return;
    }
    const draft = mediaDrafts[locationId];
    if (!draft) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const caption =
        type === 'location' ? draft.locationImageCaptionInput : draft.storyboardImageCaptionInput;
      const asset = buildProMediaAsset(
        dataUrl,
        caption || file.name.replace(/\.[a-z0-9]+$/i, ''),
        type === 'storyboard' ? draft.storyboardSceneIds : [],
        'upload'
      );
      if (type === 'location') {
        handleMediaDraftFieldChange(locationId, 'locationImages', [...draft.locationImages, asset]);
        handleMediaDraftFieldChange(locationId, 'locationImageCaptionInput', '');
      } else {
        handleMediaDraftFieldChange(locationId, 'storyboardImages', [...draft.storyboardImages, asset]);
        handleMediaDraftFieldChange(locationId, 'storyboardImageCaptionInput', '');
      }
    } catch (error) {
      console.error('Error reading media file:', error);
      showError('Kunne ikke lese bilde-filen');
    }
  };

  const handleRemoveMediaAsset = (
    locationId: string,
    type: 'locationImages' | 'storyboardImages',
    assetId: string
  ) => {
    const draft = mediaDrafts[locationId];
    if (!draft) return;
    const nextAssets = draft[type].filter((asset) => asset.id !== assetId);
    handleMediaDraftFieldChange(locationId, type, nextAssets);
  };

  const handleToggleMediaStoryboardScene = (
    locationId: string,
    assetId: string,
    sceneId: string
  ) => {
    const draft = mediaDrafts[locationId];
    if (!draft) return;
    const next = draft.storyboardImages.map((asset) => {
      if (asset.id !== assetId) return asset;
      const sceneSet = new Set(asset.sceneIds ?? []);
      if (sceneSet.has(sceneId)) {
        sceneSet.delete(sceneId);
      } else {
        sceneSet.add(sceneId);
      }
      return {
        ...asset,
        sceneIds: Array.from(sceneSet),
      };
    });
    handleMediaDraftFieldChange(locationId, 'storyboardImages', next);
  };

  const handleToggleStoryboardSceneDraftSelection = (locationId: string, sceneId: string) => {
    const draft = mediaDrafts[locationId];
    if (!draft) return;
    const next = new Set(draft.storyboardSceneIds);
    if (next.has(sceneId)) {
      next.delete(sceneId);
    } else {
      next.add(sceneId);
    }
    handleMediaDraftFieldChange(locationId, 'storyboardSceneIds', Array.from(next));
  };

  const handleSaveMedia = async (location: Location) => {
    if (savingMediaIds.has(location.id)) return;
    const draft = mediaDrafts[location.id] ?? buildProMediaDraft(location);
    setSavingMediaIds((prev) => new Set(prev).add(location.id));
    try {
      const existingMedia =
        (location as any).media && typeof (location as any).media === 'object'
          ? ((location as any).media as Record<string, unknown>)
          : {};
      const payloadMedia = {
        ...existingMedia,
        locationImages: draft.locationImages,
        storyboardImages: draft.storyboardImages,
      };
      await castingService.saveLocation(projectId, {
        ...location,
        media: payloadMedia,
        locationImages: draft.locationImages,
        storyboardImages: draft.storyboardImages,
        updatedAt: new Date().toISOString(),
      } as Location);
      const updated = await castingService.getLocations(projectId);
      setLocations(Array.isArray(updated) ? updated : []);
      setEditingMediaIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
      setMediaDrafts((prev) => {
        const next = { ...prev };
        delete next[location.id];
        return next;
      });
      showSuccess(`Media oppdatert for ${location.name}`, 2600);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving location media:', error);
      showError('Kunne ikke lagre lokasjonsbilder/storyboard');
    } finally {
      setSavingMediaIds((prev) => {
        const next = new Set(prev);
        next.delete(location.id);
        return next;
      });
    }
  };

  return (
    <Box
      component="section"
      aria-labelledby="location-panel-title"
      sx={{
        p: containerPadding,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        mx: 'auto',
        '@media (min-width: 2048px)': {
          maxWidth: 2300,
          px: 2.75,
          py: 2.25,
        },
        '@media (min-width: 3840px)': {
          maxWidth: 3400,
          px: 3.25,
          py: 2.75,
        },
        '@media (min-width: 5120px)': {
          maxWidth: 4600,
          px: 3.75,
          py: 3.25,
        },
        '& .MuiButton-root': {
          '@media (min-width: 2048px)': {
            minHeight: 46,
            fontSize: '0.96rem',
          },
          '@media (min-width: 3840px)': {
            minHeight: 52,
            fontSize: '1.04rem',
          },
          '@media (min-width: 5120px)': {
            minHeight: 58,
            fontSize: '1.12rem',
          },
        },
        '& .MuiChip-root': {
          '@media (min-width: 2048px)': { height: 30, fontSize: '0.84rem' },
          '@media (min-width: 3840px)': { height: 34, fontSize: '0.9rem' },
          '@media (min-width: 5120px)': { height: 38, fontSize: '0.96rem' },
        },
        '& .MuiIconButton-root': {
          '@media (min-width: 2048px)': { width: 42, height: 42 },
          '@media (min-width: 3840px)': { width: 46, height: 46 },
          '@media (min-width: 5120px)': { width: 52, height: 52 },
        },
      }}
    >
      {/* Header - Responsive */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          mb: 2,
          gap: { xs: 1.5, sm: 2 },
          '@media (min-width: 2048px)': { mb: 2.5, gap: 2.25 },
          '@media (min-width: 3840px)': { mb: 3, gap: 2.75 },
          '@media (min-width: 5120px)': { mb: 3.5, gap: 3.25 },
        }}
      >
        {/* Enhanced Title with gradient - matches ProductionDayView */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            py: { xs: 1, sm: 1.5 },
            '@media (min-width: 2048px)': { gap: 2.25, py: 1.7 },
            '@media (min-width: 3840px)': { gap: 2.75, py: 2 },
            '@media (min-width: 5120px)': { gap: 3.25, py: 2.4 },
          }}
        >
          <Box
            sx={{
              width: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              height: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.28) 0%, rgba(34, 211, 238, 0.2) 100%)',
              border: `2px solid ${ROLE_ROOM_COLORS.accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(168,85,247,0.26)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 18px rgba(168,85,247,0.35)',
              },
              '@media (min-width: 2048px)': { width: 78, height: 78, borderRadius: 3.2 },
              '@media (min-width: 3840px)': { width: 92, height: 92, borderRadius: 3.6 },
              '@media (min-width: 5120px)': { width: 104, height: 104, borderRadius: 4 },
            }}
          >
            <PlaceIcon
              sx={{
                color: '#c4b5fd',
                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                '@media (min-width: 2048px)': { fontSize: 48 },
                '@media (min-width: 3840px)': { fontSize: 56 },
                '@media (min-width: 5120px)': { fontSize: 64 },
              }}
            />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id="location-panel-title"
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #fff 0%, #c4b5fd 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                '@media (min-width: 2048px)': { fontSize: '2.2rem' },
                '@media (min-width: 3840px)': { fontSize: '2.45rem' },
                '@media (min-width: 5120px)': { fontSize: '2.8rem' },
              }}
            >
              Produksjonslokasjoner
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
                '@media (min-width: 2048px)': { fontSize: '1.08rem', mt: 0.4 },
                '@media (min-width: 3840px)': { fontSize: '1.2rem', mt: 0.5 },
                '@media (min-width: 5120px)': { fontSize: '1.3rem', mt: 0.6 },
              }}
            >
              <ExploreIcon
                sx={{
                  fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 },
                  opacity: 0.7,
                  '@media (min-width: 2048px)': { fontSize: 22 },
                  '@media (min-width: 3840px)': { fontSize: 25 },
                  '@media (min-width: 5120px)': { fontSize: 28 },
                }}
              />
              Administrer lokasjoner og fasiliteter
            </Typography>
          </Box>
        </Box>

        {/* Action buttons */}
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.5, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
            flexWrap: 'wrap',
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
            '@media (min-width: 2048px)': {
              gap: 1.2,
            },
            '@media (min-width: 3840px)': {
              gap: 1.5,
            },
            '@media (min-width: 5120px)': {
              gap: 1.8,
            },
            '& .MuiButton-root': {
              '@media (min-width: 2048px)': { px: 2.5, py: 1.15 },
              '@media (min-width: 3840px)': { px: 3, py: 1.35 },
              '@media (min-width: 5120px)': { px: 3.5, py: 1.55 },
            },
          }}
        >
          <Tooltip title="Eksporter til CSV (Ctrl+E)">
            <Button
              variant="outlined"
              onClick={handleExportCSV}
              aria-label="Eksporter lokasjoner til CSV"
              startIcon={<ExportIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: 'rgba(255,255,255,0.87)',
                borderColor: 'rgba(255,255,255,0.2)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Eksporter'}
            </Button>
          </Tooltip>

          <Tooltip title="Vis/skjul statistikk">
            <Button
              variant="outlined"
              onClick={() => setShowStats(!showStats)}
              aria-pressed={showStats}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: showStats ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.7)',
                borderColor: showStats ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.2)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              <StatsIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          <Tooltip title="Aapne guide (G)">
            <Button
              variant="outlined"
              onClick={() => setLocationGuideOpen(true)}
              aria-label="Aapne guide for location management"
              startIcon={<HelpIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: 'rgba(255,255,255,0.87)',
                borderColor: 'rgba(255,255,255,0.2)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Guide'}
            </Button>
          </Tooltip>

          <Tooltip title="Ny lokasjon (Ctrl+N)">
            <Button
              variant="contained"
              onClick={() => handleOpenDialog()}
              aria-label="Ny lokasjon"
              startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              sx={{
                bgcolor: '#6d28d9 !important',
                color: '#fff !important',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                flex: { xs: 1, sm: 'none' },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#5b21b6 !important' },
              }}
            >
              {isMobile ? '' : 'Ny lokasjon'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Statistics Panel - Responsive */}
      <Collapse in={showStats}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(auto-fit, minmax(120px, 1fr))' },
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 2,
            '@media (min-width: 2048px)': {
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 2.25,
              p: 2.5,
            },
            '@media (min-width: 3840px)': {
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 2.75,
              p: 3,
            },
            '@media (min-width: 5120px)': {
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 3.25,
              p: 3.5,
            },
          }}
          role="region"
          aria-label="Statistikk over lokasjoner"
        >
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <LocationIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#a855f7' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#a855f7', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.total}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Totalt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <GroupIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: ROLE_ROOM_COLORS.secondary }} />
            </Box>
            <Typography variant="h4" sx={{ color: ROLE_ROOM_COLORS.secondary, fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.totalCapacity}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Total kapasitet</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <MapIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#9333ea' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#9333ea', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.withCoordinates}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Med koordinater</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.favorites}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Favoritter</Typography>
          </Box>
          {!isMobile && Object.entries(stats.typeCount).slice(0, 3).map(([type, count]) => (
            <Box key={type} sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                {getTypeStatIcon(type)}
              </Box>
              <Typography variant="h5" sx={{ color: getTypeColor(type as Location['type']), fontWeight: 600, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.375rem', lg: '1.625rem', xl: '2rem' } }}>
                {count}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                {getTypeLabel(type as Location['type'])}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Search and Filter Controls - Responsive */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 2 },
          mb: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          '@media (min-width: 2048px)': { gap: 2.25, mb: 2.5 },
          '@media (min-width: 3840px)': { gap: 2.75, mb: 3 },
          '@media (min-width: 5120px)': { gap: 3.25, mb: 3.5 },
        }}
      >
        <TextField
          placeholder={isMobile ? 'Søk...' : 'Søk etter navn, adresse, type...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1, fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i lokasjoner' },
          }}
          sx={{
            flex: 1,
            minWidth: { sm: 200, md: 180, lg: 220, xl: 260 },
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: ROLE_ROOM_COLORS.accent },
            },
            '@media (min-width: 2048px)': {
              minWidth: 340,
            },
            '@media (min-width: 3840px)': {
              minWidth: 420,
            },
            '@media (min-width: 5120px)': {
              minWidth: 500,
            },
          }}
        />

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            justifyContent: 'space-between',
            '@media (min-width: 2048px)': { gap: 1.2 },
            '@media (min-width: 3840px)': { gap: 1.4 },
            '@media (min-width: 5120px)': { gap: 1.7 },
          }}
        >
          <Tooltip title="Vis/skjul filtre">
            <Button
              variant={showFilters ? 'contained' : 'outlined'}
              onClick={() => setShowFilters(!showFilters)}
              aria-pressed={showFilters}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: showFilters ? ROLE_ROOM_COLORS.accentSoft : 'transparent',
                color: showFilters ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.7)',
                borderColor: showFilters ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <FilterIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          <Tooltip title="Kortvisning">
            <Button
              variant={viewMode === 'grid' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'grid' ? ROLE_ROOM_COLORS.accentSoft : 'transparent',
                color: viewMode === 'grid' ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <GridViewIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          <Tooltip title="Tabellvisning">
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'table' ? ROLE_ROOM_COLORS.accentSoft : 'transparent',
                color: viewMode === 'table' ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <TableViewIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          <Tooltip title="Pro-visning">
            <Button
              variant={viewMode === 'pro' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('pro')}
              aria-pressed={viewMode === 'pro'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'pro' ? ROLE_ROOM_COLORS.secondarySoft : 'transparent',
                color: viewMode === 'pro' ? ROLE_ROOM_COLORS.secondary : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'pro' ? ROLE_ROOM_COLORS.secondary : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <AssessmentIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          {selectedIds.size > 0 && (
            <Tooltip title={`Slett ${selectedIds.size} valgte`}>
              <Button
                variant="contained"
                onClick={handleBulkDelete}
                startIcon={<DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
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
                {selectedIds.size}
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Filter Panel - Responsive */}
      <Collapse in={showFilters}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            '@media (min-width: 2048px)': {
              gap: 2.25,
              p: 2.5,
            },
            '@media (min-width: 3840px)': {
              gap: 2.75,
              p: 3,
            },
            '@media (min-width: 5120px)': {
              gap: 3.25,
              p: 3.5,
            },
          }}
        >
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150, md: 135, lg: 150, xl: 180 } }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Filtrer på type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as Location['type'] | 'all')}
              label="Filtrer på type"
              sx={{
                color: '#fff',
                minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '& .MuiSelect-select': {
                  py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                },
              }}
            >
              <MenuItem value="all" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                Alle typer
              </MenuItem>
              {locationTypes.map((type) => (
                <MenuItem key={type} value={type} sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                  {getTypeLabel(type)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Fasilitets-filter — bygger valgmuligheter fra commonFacilities */}
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150, md: 135, lg: 150, xl: 180 } }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Fasiliteter</InputLabel>
            <Select
              value={filterFacility}
              onChange={(e) => setFilterFacility(String(e.target.value))}
              label="Fasiliteter"
              sx={{
                color: '#fff',
                minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <MenuItem value="all">Alle fasiliteter</MenuItem>
              {commonFacilities.map((fac) => (
                <MenuItem key={fac} value={fac}>{getFacilityLabel(fac)}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Kart-status-filter — utfalls-fokusert språk istedenfor "har koordinater".
              Normale brukere tenker "klar til å vises på kart", ikke i lat/lng. */}
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150, md: 135, lg: 150, xl: 180 } }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Kart-status</InputLabel>
            <Select
              value={filterCoordinates}
              onChange={(e) => setFilterCoordinates(e.target.value as 'all' | 'with' | 'without')}
              label="Kart-status"
              sx={{
                color: '#fff',
                minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="with">Kart-verifisert</MenuItem>
              <MenuItem value="without">Trenger adresse-verifisering</MenuItem>
            </Select>
          </FormControl>

          {/* Region/fylke-filter — bygger valg fra eksisterende locations.
              Bruker getLocationRegion-helper (fylke → kommune → poststed-fallback) */}
          {availableRegions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150, md: 135, lg: 150, xl: 180 } }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Område</InputLabel>
              <Select
                value={filterRegion}
                onChange={(e) => setFilterRegion(String(e.target.value))}
                label="Område"
                sx={{
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="all">Alle områder</MenuItem>
                {availableRegions.map((region) => (
                  <MenuItem key={region} value={region}>{region}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {(filterType !== 'all' || filterFacility !== 'all' || filterCoordinates !== 'all' || filterRegion !== 'all' || searchQuery || sortField !== 'name' || sortDirection !== 'asc') && (
            <Button
              variant="text"
              onClick={() => {
                setFilterType('all');
                setFilterFacility('all');
                setFilterCoordinates('all');
                setFilterRegion('all');
                setSearchQuery('');
                setSortField('name');
                setSortDirection('asc');
              }}
              aria-label="Tøm alle aktive filtre og sortering"
              sx={{
                color: '#9333ea',
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                fontWeight: 600,
                ...focusVisibleStyles,
              }}
            >
              Tøm filtre
            </Button>
          )}
        </Box>
      </Collapse>

      {/* Results count */}
      {(searchQuery || filterType !== 'all') && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(168,85,247,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#a855f7' },
          }}
        >
          Viser {filteredAndSortedLocations.length} av {locations.length} lokasjoner
        </Alert>
      )}

      {/* Empty state */}
      {locations.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={locationPng}
          title="Ingen lokasjoner ennå"
          subtitle="Legg til lokasjoner for å organisere produksjonslokasjoner"
          color="#a855f7"
        />
      ) : filteredAndSortedLocations.length === 0 ? (
        <Box role="status" sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.87)' }}>
          <SearchIcon sx={{ fontSize: { xs: 48, sm: 56, md: 52, lg: 64, xl: 80 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, opacity: 0.3 }} />
          <Typography variant="body1" sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }}>Ingen treff på søket</Typography>
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
          <Table
            aria-label="Lokasjoner tabell"
            sx={{
              minWidth: { xs: 600, sm: 700, md: 750, lg: 850, xl: 1100 },
              '@media (min-width: 2048px)': { minWidth: 1600 },
              '@media (min-width: 3840px)': { minWidth: 2200 },
              '@media (min-width: 5120px)': { minWidth: 2800 },
              '& .MuiTableCell-root': {
                '@media (min-width: 2048px)': { py: 1.8 },
                '@media (min-width: 3840px)': { py: 2.1, fontSize: '1.08rem' },
                '@media (min-width: 5120px)': { py: 2.4, fontSize: '1.16rem' },
              },
            }}
          >
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedLocations.length && filteredAndSortedLocations.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedLocations.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle lokasjoner"
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#a855f7' } }}
                  />
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#a855f7' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'type'}
                    direction={sortField === 'type' ? sortDirection : 'asc'}
                    onClick={() => handleSort('type')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#a855f7' } }}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Adresse</TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'capacity'}
                    direction={sortField === 'capacity' ? sortDirection : 'asc'}
                    onClick={() => handleSort('capacity')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#a855f7' } }}
                  >
                    Kapasitet
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'scenes'}
                    direction={sortField === 'scenes' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scenes')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#a855f7' } }}
                  >
                    Scener
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedLocations.map((location) => (
                <TableRow
                  key={location.id}
                  sx={{
                    bgcolor: selectedIds.has(location.id) ? 'rgba(168,85,247,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(location.id)}
                      onChange={() => handleToggleSelect(location.id)}
                      inputProps={{ 'aria-label': `Velg lokasjon ${location.name}` }}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#a855f7' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      {favorites.has(location.id) && <StarIcon sx={{ color: '#ffc107', fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                      <Typography sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>{location.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip
                      label={getTypeLabel(location.type)}
                      size="small"
                      sx={{ 
                        bgcolor: `${getTypeColor(location.type)}33`, 
                        color: getTypeColor(location.type),
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                        height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                        {location.address || '-'}
                      </Typography>
                      {location.address && (
                        <Tooltip title={copiedId === location.id ? 'Kopiert!' : 'Kopier adresse'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyAddress(location.address ?? '', location.id)}
                            aria-label={`Kopier adresse for ${location.name}`}
                            sx={{ color: copiedId === location.id ? '#a855f7' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                          >
                            {copiedId === location.id ? <CheckIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} /> : <CopyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                      {location.capacity || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                      {normalizeSceneIds(location.assignedScenes).length}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      <Tooltip title={favorites.has(location.id) ? 'Fjern favoritt' : 'Favoritt'}>
                        <IconButton
                          onClick={() => toggleFavorite(location.id)}
                          aria-label={favorites.has(location.id) ? `Fjern ${location.name} fra favoritter` : `Legg til ${location.name} i favoritter`}
                          sx={{ color: favorites.has(location.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                        >
                          {favorites.has(location.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton
                          onClick={() => handleDuplicate(location)}
                          aria-label={`Dupliser ${location.name}`}
                          sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                        >
                          <DuplicateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton
                          onClick={() => handleOpenDialog(location)}
                          aria-label={`Rediger ${location.name}`}
                          sx={{ color: '#a855f7', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton
                          onClick={() => handleDeleteWithUndo(location.id)}
                          aria-label={`Slett ${location.name}`}
                          sx={{ color: '#ff4444', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                        >
                          <DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : viewMode === 'pro' ? (
        <Stack
          spacing={{ xs: 1.5, sm: 2, md: 2.5 }}
          sx={{
            '@media (min-width: 2048px)': {
              '& .location-pro-map-card .MuiCardContent-root, & .location-pro-list-card .MuiCardContent-root': {
                p: 2.5,
              },
              '& .location-pro-work-card .MuiCardContent-root': {
                p: 2,
              },
            },
            '@media (min-width: 3840px)': {
              '& .location-pro-map-card .MuiCardContent-root, & .location-pro-list-card .MuiCardContent-root': {
                p: 3,
              },
              '& .location-pro-work-card .MuiCardContent-root': {
                p: 2.35,
              },
              '& .location-pro-work-card .MuiTypography-root': {
                fontSize: '1.02em',
              },
            },
            '@media (min-width: 5120px)': {
              '& .location-pro-map-card .MuiCardContent-root, & .location-pro-list-card .MuiCardContent-root': {
                p: 3.5,
              },
              '& .location-pro-work-card .MuiCardContent-root': {
                p: 2.7,
              },
              '& .location-pro-work-card .MuiTypography-root': {
                fontSize: '1.1em',
              },
            },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(6, minmax(0, 1fr))',
              },
              gap: { xs: 1, sm: 1.25, md: 1.5 },
              mx: 'auto',
              width: '100%',
              '@media (min-width: 2048px)': {
                gap: 2,
              },
              '@media (min-width: 3840px)': {
                gap: 2.5,
              },
              '@media (min-width: 5120px)': {
                gap: 3,
              },
            }}
          >
            {([
              { key: 'ready_today', label: 'Klar i dag', value: operationalStats.readyToday, color: '#34d399' },
              { key: 'permit_missing', label: 'Mangler tillatelse', value: operationalStats.permitMissing, color: '#fbbf24' },
              { key: 'high_risk', label: 'Høy risiko', value: operationalStats.highRisk, color: '#f87171' },
              { key: 'over_budget', label: 'Over budsjett', value: operationalStats.overBudget, color: '#fb7185' },
              { key: 'with_shots', label: 'Har shotlist', value: operationalStats.withShots, color: '#22d3ee' },
              { key: 'all', label: 'Totalt i visning', value: operationalStats.total, color: '#c084fc' },
            ] as Array<{ key: OperationalFilterKey; label: string; value: number; color: string }>).map((item) => (
              <Button
                key={item.key}
                variant="outlined"
                onClick={() => setOperationalFilter(item.key)}
                sx={{
                  justifyContent: 'space-between',
                  px: { xs: 1, sm: 1.25, md: 1.5 },
                  py: { xs: 1, sm: 1.25 },
                  borderRadius: 2,
                  borderColor: operationalFilter === item.key ? item.color : 'rgba(255,255,255,0.2)',
                  bgcolor: operationalFilter === item.key ? `${item.color}1f` : 'rgba(255,255,255,0.03)',
                  color: '#fff',
                  textTransform: 'none',
                  minHeight: TOUCH_TARGET_SIZE,
                  '@media (min-width: 2048px)': {
                    px: 2,
                    py: 1.35,
                    minHeight: 52,
                  },
                  '@media (min-width: 3840px)': {
                    px: 2.5,
                    py: 1.6,
                    minHeight: 60,
                    borderRadius: 2.5,
                  },
                  '@media (min-width: 5120px)': {
                    px: 3,
                    py: 1.8,
                    minHeight: 66,
                    borderRadius: 3,
                  },
                }}
              >
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: { xs: '0.72rem', sm: '0.8rem' },
                    '@media (min-width: 2048px)': { fontSize: '0.88rem' },
                    '@media (min-width: 3840px)': { fontSize: '1rem' },
                    '@media (min-width: 5120px)': { fontSize: '1.08rem' },
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  sx={{
                    color: item.color,
                    fontWeight: 800,
                    fontSize: { xs: '1.05rem', sm: '1.2rem' },
                    '@media (min-width: 2048px)': { fontSize: '1.35rem' },
                    '@media (min-width: 3840px)': { fontSize: '1.55rem' },
                    '@media (min-width: 5120px)': { fontSize: '1.75rem' },
                  }}
                >
                  {item.value}
                </Typography>
              </Button>
            ))}
          </Box>

          <Card sx={{ bgcolor: ROLE_ROOM_COLORS.panel, border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Stack spacing={1.25}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {(['all', 'tech_scout', 'permits', 'night_shoot', 'low_budget'] as ProPresetId[]).map((presetId) => (
                    <Chip
                      key={presetId}
                      label={PRO_PRESET_LABELS[presetId]}
                      onClick={() => setProPreset(presetId)}
                      color={proPreset === presetId ? 'primary' : 'default'}
                      sx={{
                        bgcolor: proPreset === presetId ? ROLE_ROOM_COLORS.accentSoft : 'rgba(255,255,255,0.05)',
                        color: proPreset === presetId ? ROLE_ROOM_COLORS.accent : 'rgba(255,255,255,0.82)',
                        border: `1px solid ${proPreset === presetId ? ROLE_ROOM_COLORS.accentBorder : 'rgba(255,255,255,0.18)'}`,
                        fontWeight: 600,
                      }}
                    />
                  ))}
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'minmax(260px,1.6fr) minmax(220px,1fr) minmax(220px,1fr) auto auto',
                    },
                    gap: 1,
                    alignItems: 'center',
                    '@media (min-width: 2048px)': {
                      gridTemplateColumns:
                        'minmax(360px,2fr) minmax(280px,1.2fr) minmax(280px,1.2fr) auto auto',
                      gap: 1.25,
                    },
                    '@media (min-width: 3840px)': {
                      gridTemplateColumns:
                        'minmax(460px,2.3fr) minmax(340px,1.3fr) minmax(340px,1.3fr) auto auto',
                      gap: 1.5,
                    },
                    '@media (min-width: 5120px)': {
                      gridTemplateColumns:
                        'minmax(540px,2.5fr) minmax(400px,1.35fr) minmax(400px,1.35fr) auto auto',
                      gap: 1.75,
                    },
                    '& > *': { minWidth: 0 },
                  }}
                >
                  <TextField
                    size="small"
                    label="Navn på visning"
                    placeholder="F.eks. Tech scout uke 2"
                    value={proViewName}
                    onChange={(event) => setProViewName(event.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' } },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                    }}
                  />
                  <FormControl
                    size="small"
                    sx={{
                      minWidth: 0,
                      '@media (min-width: 2048px)': { minWidth: 260 },
                      '@media (min-width: 3840px)': { minWidth: 320 },
                    }}
                  >
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.72)' }}>Lagrede visninger</InputLabel>
                    <Select
                      value={selectedProViewId}
                      label="Lagrede visninger"
                      onChange={(event) => {
                        const next = String(event.target.value);
                        if (next === 'custom') {
                          setSelectedProViewId('custom');
                          return;
                        }
                        const existing = savedProViews.find((view) => view.id === next);
                        if (existing) {
                          applySavedProView(existing);
                        }
                      }}
                      sx={{
                        color: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                      }}
                    >
                      <MenuItem value="custom">Custom / Nåværende</MenuItem>
                      {savedProViews.map((view) => (
                        <MenuItem key={view.id} value={view.id}>
                          {view.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    size="small"
                    sx={{
                      minWidth: 0,
                      '@media (min-width: 2048px)': { minWidth: 260 },
                      '@media (min-width: 3840px)': { minWidth: 320 },
                    }}
                  >
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.72)' }}>Operativt filter</InputLabel>
                    <Select
                      value={operationalFilter}
                      label="Operativt filter"
                      onChange={(event) => setOperationalFilter(event.target.value as OperationalFilterKey)}
                      sx={{
                        color: '#fff',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                      }}
                    >
                      {(Object.keys(OPERATIONAL_FILTER_LABELS) as OperationalFilterKey[]).map((key) => (
                        <MenuItem key={key} value={key}>
                          {OPERATIONAL_FILTER_LABELS[key]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveCurrentProView}
                    sx={{
                      minHeight: TOUCH_TARGET_SIZE,
                      whiteSpace: 'nowrap',
                      px: { xs: 1.5, sm: 2 },
                      bgcolor: ROLE_ROOM_COLORS.accent,
                      '&:hover': { bgcolor: ROLE_ROOM_COLORS.accentStrong },
                      '@media (min-width: 2048px)': { minHeight: 52, px: 2.5 },
                      '@media (min-width: 3840px)': { minHeight: 58, px: 3 },
                      '@media (min-width: 5120px)': { minHeight: 64, px: 3.5, fontSize: '1.04rem' },
                    }}
                  >
                    Lagre view
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleDeleteSavedProView}
                    disabled={selectedProViewId === 'custom'}
                    sx={{
                      minHeight: TOUCH_TARGET_SIZE,
                      whiteSpace: 'nowrap',
                      px: { xs: 1.5, sm: 2 },
                      '@media (min-width: 2048px)': { minHeight: 52, px: 2.5 },
                      '@media (min-width: 3840px)': { minHeight: 58, px: 3 },
                      '@media (min-width: 5120px)': { minHeight: 64, px: 3.5, fontSize: '1.04rem' },
                    }}
                  >
                    Slett view
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {selectedIds.size > 0 && (
            <Card sx={{ bgcolor: 'rgba(20,16,46,0.82)', border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}>
              <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'minmax(220px,1fr) repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1,
                    alignItems: 'center',
                    '@media (min-width: 2048px)': {
                      gridTemplateColumns: 'minmax(300px,1.2fr) repeat(4, minmax(220px,1fr))',
                      gap: 1.25,
                    },
                    '@media (min-width: 3840px)': {
                      gridTemplateColumns: 'minmax(380px,1.3fr) repeat(4, minmax(280px,1fr))',
                      gap: 1.5,
                    },
                    '@media (min-width: 5120px)': {
                      gridTemplateColumns: 'minmax(460px,1.35fr) repeat(4, minmax(340px,1fr))',
                      gap: 1.75,
                    },
                    '& > *': { minWidth: 0 },
                  }}
                >
                  <FormControl size="small">
                    <InputLabel sx={{ color: 'rgba(255,255,255,0.72)' }}>Status</InputLabel>
                    <Select
                      value={bulkWorkflowStatus}
                      label="Status"
                      onChange={(event) => setBulkWorkflowStatus(event.target.value as BulkWorkflowStatus)}
                      sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' } }}
                    >
                      <MenuItem value="ready">Klar</MenuItem>
                      <MenuItem value="hold">På vent</MenuItem>
                      <MenuItem value="blocked">Blokkert</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    onClick={handleBulkSetWorkflowStatus}
                    startIcon={<VerifiedIcon />}
                    sx={{ minHeight: TOUCH_TARGET_SIZE, whiteSpace: 'nowrap' }}
                  >
                    Sett status
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleBulkAssignTechnicalTeam}
                    startIcon={<EngineeringIcon />}
                    sx={{ minHeight: TOUCH_TARGET_SIZE, whiteSpace: 'nowrap' }}
                  >
                    Tildel team
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleBulkCopyFacilitiesFromActive}
                    startIcon={<DuplicateIcon />}
                    sx={{ minHeight: TOUCH_TARGET_SIZE, whiteSpace: 'nowrap' }}
                  >
                    Kopier tags
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleExportSelectedCallSheet}
                    startIcon={<ExportIcon />}
                    sx={{ minHeight: TOUCH_TARGET_SIZE, whiteSpace: 'nowrap' }}
                  >
                    Eksporter call sheet
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                lg: 'minmax(0,1.45fr) minmax(320px,1fr)',
                xl: 'minmax(0,1.6fr) minmax(360px,1fr)',
              },
              gap: { xs: 2, sm: 2.5, md: 2.75, lg: 3 },
              '@media (min-width: 2048px)': {
                gridTemplateColumns: 'minmax(0,1.75fr) minmax(460px,1fr)',
                gap: 3.25,
              },
              '@media (min-width: 3840px)': {
                gridTemplateColumns: 'minmax(0,1.85fr) minmax(620px,1fr)',
                gap: 3.75,
              },
              '@media (min-width: 5120px)': {
                gridTemplateColumns: 'minmax(0,1.95fr) minmax(760px,1fr)',
                gap: 4.25,
              },
            }}
          >
            <Stack spacing={{ xs: 1.5, sm: 2 }}>
              <Card
                className="location-pro-map-card"
                sx={{ bgcolor: ROLE_ROOM_COLORS.panel, border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1.25 }}>
                    Kart + kort (60/40)
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'minmax(0,1.4fr) minmax(0,1fr)',
                        xl: 'minmax(0,1.6fr) minmax(0,1fr)',
                      },
                      gap: { xs: 1.25, sm: 1.5 },
                      alignItems: 'stretch',
                      '@media (min-width: 2048px)': {
                        gridTemplateColumns: 'minmax(0,1.8fr) minmax(360px,1fr)',
                        gap: 2,
                      },
                      '@media (min-width: 3840px)': {
                        gridTemplateColumns: 'minmax(0,1.9fr) minmax(520px,1fr)',
                        gap: 2.5,
                      },
                      '@media (min-width: 5120px)': {
                        gridTemplateColumns: 'minmax(0,2fr) minmax(620px,1fr)',
                        gap: 3,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        borderRadius: 2,
                        minHeight: proMapMinHeight,
                        border: '1px solid rgba(255,255,255,0.16)',
                        background: 'rgba(10,8,27,0.9)',
                        overflow: 'hidden',
                        '& .leaflet-container': {
                          width: '100%',
                          height: '100%',
                          minHeight: proMapMinHeight,
                          background: '#0f172a',
                        },
                      }}
                    >
                      {mapLocations.length === 0 ? (
                        <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.9rem' }}>
                            Ingen koordinater tilgjengelig i gjeldende visning.
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          <MapContainer
                            center={[activeMapLocation?.lat ?? mapLocations[0].lat, activeMapLocation?.lng ?? mapLocations[0].lng]}
                            zoom={13}
                            scrollWheelZoom
                            style={{ height: '100%', minHeight: proMapMinHeight, width: '100%' }}
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <LocationLeafletSync bounds={mapBounds} activeLocation={activeMapLocation} />
                            {mapLocations.map((pin) => {
                              const active = activeMapLocationId === pin.locationId;
                              return (
                                <CircleMarker
                                  key={pin.locationId}
                                  center={[pin.lat, pin.lng]}
                                  radius={active ? 10 : 8}
                                  pathOptions={{
                                    color: '#ffffff',
                                    weight: active ? 2 : 1.5,
                                    fillColor: pin.typeColor,
                                    fillOpacity: active ? 0.95 : 0.8,
                                  }}
                                  eventHandlers={{
                                    mouseover: () => setActiveMapLocationId(pin.locationId),
                                    click: () => setActiveMapLocationId(pin.locationId),
                                  }}
                                >
                                  <LeafletMapTooltip direction="top" offset={[0, -10]} opacity={1}>
                                    {pin.name}
                                  </LeafletMapTooltip>
                                </CircleMarker>
                              );
                            })}
                          </MapContainer>
                          {activeMapExternalUrl ? (
                            <Box sx={{ position: 'absolute', right: 8, top: 8, zIndex: 800 }}>
                              <Button
                                component="a"
                                href={activeMapExternalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                variant="outlined"
                                sx={{
                                  textTransform: 'none',
                                  minHeight: 30,
                                  fontSize: '0.75rem',
                                  bgcolor: 'rgba(10,8,27,0.65)',
                                  borderColor: 'rgba(255,255,255,0.35)',
                                  color: '#fff',
                                  '&:hover': {
                                    bgcolor: 'rgba(10,8,27,0.82)',
                                    borderColor: 'rgba(255,255,255,0.55)',
                                  },
                                }}
                              >
                                Åpne kart
                              </Button>
                            </Box>
                          ) : null}
                          {activeMapLocation ? (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: 8,
                                bottom: 8,
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                bgcolor: 'rgba(10,8,27,0.72)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                zIndex: 800,
                              }}
                            >
                              <Typography sx={{ color: 'rgba(255,255,255,0.92)', fontSize: '0.7rem', fontWeight: 600 }}>
                                Aktiv: {activeMapLocation.name}
                              </Typography>
                            </Box>
                          ) : null}
                        </>
                      )}
                    </Box>

                    <Stack
                      spacing={1}
                      sx={{
                        maxHeight: { xs: 'none', md: proMapMinHeight },
                        overflow: 'auto',
                        pr: { md: 0.5, '@media (min-width: 3840px)': 0.8 },
                      }}
                    >
                      {proFilteredAndSortedLocations.slice(0, 8).map((location) => {
                        const metric = locationMetricsById[location.id];
                        const isActive = activeMapLocationId === location.id;
                        const hasCoordinates = Boolean(
                          typeof location.coordinates?.lat === 'number' && typeof location.coordinates?.lng === 'number'
                        );
                        return (
                          <Button
                            key={location.id}
                            variant="outlined"
                            onClick={() => {
                              if (hasCoordinates) {
                                setActiveMapLocationId(location.id);
                              }
                            }}
                            disabled={!hasCoordinates}
                            sx={{
                              justifyContent: 'space-between',
                              textTransform: 'none',
                              borderColor: isActive && hasCoordinates ? ROLE_ROOM_COLORS.secondary : 'rgba(255,255,255,0.2)',
                              bgcolor: isActive && hasCoordinates ? ROLE_ROOM_COLORS.secondarySoft : 'rgba(255,255,255,0.02)',
                              color: hasCoordinates ? '#fff' : 'rgba(255,255,255,0.5)',
                              minHeight: TOUCH_TARGET_SIZE,
                              '@media (min-width: 2048px)': { minHeight: 50 },
                              '@media (min-width: 3840px)': { minHeight: 56 },
                              '@media (min-width: 5120px)': { minHeight: 62 },
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: '0.85rem',
                                maxWidth: '75%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                '@media (min-width: 2048px)': { fontSize: '0.95rem' },
                                '@media (min-width: 3840px)': { fontSize: '1.04rem' },
                                '@media (min-width: 5120px)': { fontSize: '1.12rem' },
                              }}
                            >
                              {location.name}
                            </Typography>
                            <Chip
                              size="small"
                              label={hasCoordinates ? (metric ? `${metric.readinessScore}%` : '-') : 'Ingen koordinater'}
                              sx={{
                                bgcolor: hasCoordinates ? 'rgba(255,255,255,0.12)' : 'rgba(248,113,113,0.16)',
                                color: hasCoordinates ? '#fff' : '#fca5a5',
                              }}
                            />
                          </Button>
                        );
                      })}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>

              <Card
                className="location-pro-list-card"
                sx={{ bgcolor: ROLE_ROOM_COLORS.panel, border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      Pro-arbeidsliste
                    </Typography>
                    <Chip
                      label={`${proFilteredAndSortedLocations.length} lokasjoner`}
                      size="small"
                      sx={{
                        bgcolor: ROLE_ROOM_COLORS.accentSoft,
                        color: ROLE_ROOM_COLORS.accent,
                        border: `1px solid ${ROLE_ROOM_COLORS.accentBorder}`,
                        fontWeight: 700,
                      }}
                    />
                  </Box>
                  <Stack spacing={1.25}>
                    {proVisibleLocations.map((location) => {
                      const metric = locationMetricsById[location.id];
                      const typeColor = getTypeColor(location.type);
                      const hasCoordinates = Boolean(
                        typeof location.coordinates?.lat === 'number' && typeof location.coordinates?.lng === 'number'
                      );
                      const riskColor =
                        metric?.riskLevel === 'hoy' ? '#f87171' : metric?.riskLevel === 'moderat' ? '#fbbf24' : '#34d399';
                      const isEditingProContact = editingProContactIds.has(location.id);
                      const isSavingProContact = savingProContactIds.has(location.id);
                      const proContactDraft = proContactDrafts[location.id] ?? buildProContactDraft(location);
                      const proContactName = proContactDraft.name.trim();
                      const proContactPhone = proContactDraft.phone.trim();
                      const proContactEmail = proContactDraft.email.trim();
                      const isBasecamp = Boolean((location as any).isBasecamp);
                      const isSavingBasecamp = savingBasecampIds.has(location.id);
                      const loadFlow = ((location as any).loadFlow ?? {}) as Record<string, unknown>;
                      const loadFlowStatusRaw = String(loadFlow.status ?? 'planned').toLowerCase();
                      const loadFlowStatus: LoadFlowStatus =
                        loadFlowStatusRaw === 'ready' ||
                        loadFlowStatusRaw === 'in_progress' ||
                        loadFlowStatusRaw === 'completed'
                          ? (loadFlowStatusRaw as LoadFlowStatus)
                          : 'planned';
                      const loadFlowStatusMeta: Record<LoadFlowStatus, { label: string; color: string }> = {
                        planned: { label: 'Planlagt', color: '#c084fc' },
                        ready: { label: 'Klar', color: '#34d399' },
                        in_progress: { label: 'Pågår', color: '#22d3ee' },
                        completed: { label: 'Ferdig', color: '#86efac' },
                      };
                      const isEditingLoadFlow = editingLoadFlowIds.has(location.id);
                      const isSavingLoadFlow = savingLoadFlowIds.has(location.id);
                      const loadFlowDraft = loadFlowDrafts[location.id] ?? buildProLoadFlowDraft(location);
                      const isEditingSceneLinks = editingSceneLinkIds.has(location.id);
                      const isSavingSceneLinks = savingSceneLinkIds.has(location.id);
                      const sceneDraftIds = sceneLinkDrafts[location.id] ?? normalizeSceneIds(location.assignedScenes);
                      const linkedSceneIds = normalizeSceneIds(location.assignedScenes);
                      const linkedSceneInsights = linkedSceneIds.map((sceneId) => {
                        const insight = proSceneInsightsById[sceneId];
                        if (insight) return insight;
                        const option = proSceneOptions.find((scene) => scene.id === sceneId);
                        return {
                          sceneId,
                          sceneLabel: option?.label ?? `Scene ${sceneId}`,
                          shotCount: 0,
                          shotListCount: 0,
                          callbackCount: 0,
                          crewTouchpoints: 0,
                          equipment: [],
                          storyboardCount: 0,
                        } as ProSceneInsight;
                      });
                      const linkedSceneSummary = linkedSceneInsights.reduce(
                        (acc, scene) => {
                          acc.shots += scene.shotCount;
                          acc.callbacks += scene.callbackCount;
                          acc.storyboard += scene.storyboardCount;
                          acc.equipment += scene.equipment.length;
                          acc.crew += scene.crewTouchpoints;
                          acc.shotLists += scene.shotListCount;
                          return acc;
                        },
                        { shots: 0, callbacks: 0, storyboard: 0, equipment: 0, crew: 0, shotLists: 0 }
                      );
                      const isEditingMedia = editingMediaIds.has(location.id);
                      const isSavingMedia = savingMediaIds.has(location.id);
                      const mediaDraft = mediaDrafts[location.id] ?? buildProMediaDraft(location);
                      const locationMediaImages = mediaDraft.locationImages;
                      const storyboardMediaImages = mediaDraft.storyboardImages;
                      const mediaSceneIdsSource =
                        sceneDraftIds.length > 0
                          ? sceneDraftIds
                          : linkedSceneIds.length > 0
                            ? linkedSceneIds
                            : proSceneOptions.map((scene) => scene.id);
                      const mediaSceneOptions = mediaSceneIdsSource.slice(0, 24).map((sceneId) => ({
                        id: sceneId,
                        label: proSceneLabelById.get(sceneId) ?? `Scene ${sceneId}`,
                      }));
                      const mediaSceneOverflowCount = Math.max(
                        mediaSceneIdsSource.length - mediaSceneOptions.length,
                        0
                      );
                      const isConsistencyHighlighted = consistencyIndicator?.locationId === location.id;
                      const consistencySection = isConsistencyHighlighted
                        ? consistencyIndicator?.section ?? null
                        : null;
                      const proSectionState = getProSectionState(location.id);
                      const summaryExpanded = proSectionState.summary;
                      const loadFlowExpanded = proSectionState.loadFlow;
                      const sceneLinksExpanded = proSectionState.sceneLinks;
                      const mediaExpanded = proSectionState.media;
                      const contactExpanded = proSectionState.contact;
                      return (
                        <Card
                          className="location-pro-work-card"
                          key={location.id}
                          id={`location-pro-card-${location.id}`}
                          sx={{
                            bgcolor: isConsistencyHighlighted
                              ? 'rgba(251,191,36,0.12)'
                              : activeMapLocationId === location.id
                                ? 'rgba(34,211,238,0.12)'
                                : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${
                              isConsistencyHighlighted
                                ? 'rgba(251,191,36,0.62)'
                                : activeMapLocationId === location.id
                                  ? 'rgba(34,211,238,0.45)'
                                  : 'rgba(255,255,255,0.14)'
                            }`,
                            borderRadius: 2.25,
                            boxShadow: isConsistencyHighlighted
                              ? '0 0 0 1px rgba(251,191,36,0.45), 0 0 18px rgba(251,191,36,0.35)'
                              : 'none',
                            animation: isConsistencyHighlighted
                              ? 'locationConsistencyPulse 1.35s ease-out 2'
                              : 'none',
                            '@keyframes locationConsistencyPulse': {
                              '0%': {
                                boxShadow: '0 0 0 0 rgba(251,191,36,0.45)',
                              },
                              '70%': {
                                boxShadow: '0 0 0 10px rgba(251,191,36,0)',
                              },
                              '100%': {
                                boxShadow: '0 0 0 0 rgba(251,191,36,0)',
                              },
                            },
                          }}
                        >
                          <CardContent sx={{ p: { xs: 1.25, sm: 1.5 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                                <Checkbox
                                  checked={selectedIds.has(location.id)}
                                  onChange={() => handleToggleSelect(location.id)}
                                  inputProps={{ 'aria-label': `Velg lokasjon ${location.name}` }}
                                  sx={{ color: 'rgba(255,255,255,0.72)', '&.Mui-checked': { color: ROLE_ROOM_COLORS.accent } }}
                                />
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography sx={{ color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {location.name}
                                  </Typography>
                                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                                    <Chip size="small" label={getTypeLabel(location.type)} sx={{ bgcolor: `${typeColor}2b`, color: typeColor }} />
                                    <Chip size="small" label={`${metric?.readinessScore ?? 0}% klar`} sx={{ bgcolor: 'rgba(34,211,238,0.2)', color: '#67e8f9' }} />
                                    <Chip size="small" label={`Risiko ${metric?.riskScore ?? 0}`} sx={{ bgcolor: `${riskColor}26`, color: riskColor }} />
                                  </Stack>
                                </Box>
                              </Box>
                              <Stack direction="row" spacing={0.5}>
                                <Tooltip title={favorites.has(location.id) ? 'Fjern favoritt' : 'Favoritt'}>
                                  <IconButton
                                    onClick={() => toggleFavorite(location.id)}
                                    aria-label={favorites.has(location.id) ? `Fjern ${location.name} fra favoritter` : `Legg til ${location.name} i favoritter`}
                                    sx={{ color: favorites.has(location.id) ? '#facc15' : 'rgba(255,255,255,0.35)' }}
                                  >
                                    {favorites.has(location.id) ? <StarIcon /> : <StarBorderIcon />}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Analyser lokasjon">
                                  <IconButton
                                    onClick={() => handleOpenAnalysisDialog(location)}
                                    aria-label={`Analyser ${location.name}`}
                                    sx={{ color: ROLE_ROOM_COLORS.secondary }}
                                  >
                                    <AnalyticsIcon />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </Box>

                            <Box sx={{ mt: 1.1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.84)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                  Oversikt
                                </Typography>
                                {consistencySection === 'summary' ? (
                                  <Chip
                                    size="small"
                                    icon={<ExploreIcon sx={{ fontSize: 14 }} />}
                                    label="Fra konsistenssjekk"
                                    sx={{
                                      bgcolor: 'rgba(251,191,36,0.22)',
                                      color: '#fde68a',
                                      border: '1px solid rgba(251,191,36,0.45)',
                                    }}
                                  />
                                ) : null}
                              </Box>
                              <Button
                                size="small"
                                endIcon={summaryExpanded ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
                                onClick={() => toggleProSection(location.id, 'summary')}
                                sx={{ color: ROLE_ROOM_COLORS.secondary, textTransform: 'none', minWidth: 0, px: 1 }}
                              >
                                {summaryExpanded ? 'Skjul' : 'Vis'}
                              </Button>
                            </Box>
                            <Collapse in={summaryExpanded}>
                              <Box
                                sx={{
                                  mt: 0.8,
                                  display: 'grid',
                                  gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'repeat(2, minmax(0, 1fr))',
                                    lg: 'repeat(4, minmax(0, 1fr))',
                                  },
                                  gap: 1,
                                  '@media (min-width: 2048px)': {
                                    gap: 1.25,
                                  },
                                  '@media (min-width: 3840px)': {
                                    gap: 1.5,
                                  },
                                  '@media (min-width: 5120px)': {
                                    gap: 1.8,
                                  },
                                }}
                              >
                                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                                  <Typography sx={{ color: ROLE_ROOM_COLORS.mutedText, fontSize: '0.7rem', textTransform: 'uppercase' }}>Logistikk</Typography>
                                  <Typography sx={{ color: '#fff', fontSize: '0.82rem', mt: 0.4 }}>
                                    {hasCoordinates ? 'Koordinater klare' : 'Mangler koordinater'}
                                  </Typography>
                                  <Typography sx={{ color: ROLE_ROOM_COLORS.secondary, fontWeight: 700, fontSize: '0.8rem' }}>
                                    {location.capacity || 0} kapasitet
                                  </Typography>
                                </Box>
                                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                                  <Typography sx={{ color: ROLE_ROOM_COLORS.mutedText, fontSize: '0.7rem', textTransform: 'uppercase' }}>Tillatelser</Typography>
                                  <Typography sx={{ color: metric?.permitMissing ? '#fbbf24' : '#34d399', fontWeight: 700, fontSize: '0.82rem', mt: 0.4 }}>
                                    {metric?.permitMissing ? 'Mangler dokumentasjon' : 'Dokumentert'}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.76rem' }}>
                                    {location.facilities?.length || 0} fasiliteter
                                  </Typography>
                                </Box>
                                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                                  <Typography sx={{ color: ROLE_ROOM_COLORS.mutedText, fontSize: '0.7rem', textTransform: 'uppercase' }}>Teknisk</Typography>
                                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', mt: 0.4 }}>
                                    {metric?.technicalCoverage ?? 0}% dekning
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.76rem' }}>
                                    {metric?.missingTechnicalRoles.length ?? 0} roller mangler
                                  </Typography>
                                </Box>
                                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                                  <Typography sx={{ color: ROLE_ROOM_COLORS.mutedText, fontSize: '0.7rem', textTransform: 'uppercase' }}>Kost</Typography>
                                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem', mt: 0.4 }}>
                                    {new Intl.NumberFormat('nb-NO').format(metric?.estimatedCost ?? 0)} kr
                                  </Typography>
                                  <Typography sx={{ color: metric?.overBudget ? '#f87171' : '#34d399', fontSize: '0.76rem' }}>
                                    {metric?.overBudget ? 'Over budsjettgrense' : 'Innenfor budsjett'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Collapse>

                            <Box
                              sx={{
                                mt: 1.1,
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(34,211,238,0.08)',
                                border: '1px solid rgba(34,211,238,0.24)',
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <BasecampIcon sx={{ fontSize: 16, color: '#67e8f9' }} />
                                  <Typography sx={{ color: '#67e8f9', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                    Basecamp + load-in/out
                                  </Typography>
                                  {consistencySection === 'loadFlow' ? (
                                    <Chip
                                      size="small"
                                      icon={<ExploreIcon sx={{ fontSize: 14 }} />}
                                      label="Fra konsistenssjekk"
                                      sx={{
                                        bgcolor: 'rgba(251,191,36,0.22)',
                                        color: '#fde68a',
                                        border: '1px solid rgba(251,191,36,0.45)',
                                      }}
                                    />
                                  ) : null}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <Button
                                    size="small"
                                    onClick={() => void handleToggleBasecamp(location)}
                                    disabled={isSavingBasecamp}
                                    sx={{
                                      color: isBasecamp ? '#34d399' : '#67e8f9',
                                      textTransform: 'none',
                                      minWidth: 0,
                                      px: 1,
                                    }}
                                  >
                                    {isSavingBasecamp ? 'Lagrer...' : isBasecamp ? 'Basecamp aktiv' : 'Sett basecamp'}
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      isEditingLoadFlow ? handleCancelLoadFlowEditing(location) : handleToggleLoadFlowEditing(location)
                                    }
                                    sx={{ color: ROLE_ROOM_COLORS.secondary, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {isEditingLoadFlow ? 'Lukk flow' : 'Rediger flow'}
                                  </Button>
                                  <Button
                                    size="small"
                                    endIcon={loadFlowExpanded ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => toggleProSection(location.id, 'loadFlow')}
                                    sx={{ color: ROLE_ROOM_COLORS.secondary, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {loadFlowExpanded ? 'Skjul' : 'Vis'}
                                  </Button>
                                </Box>
                              </Box>

                              <Collapse in={loadFlowExpanded}>
                                <Box sx={{ mt: 1, display: 'flex', gap: 0.65, flexWrap: 'wrap' }}>
                                  <Chip
                                    size="small"
                                    icon={<BasecampIcon sx={{ fontSize: 15 }} />}
                                    label={isBasecamp ? 'Basecamp' : 'Ikke basecamp'}
                                    sx={{
                                      bgcolor: isBasecamp ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)',
                                      color: isBasecamp ? '#86efac' : 'rgba(255,255,255,0.72)',
                                    }}
                                  />
                                  <Chip
                                    size="small"
                                    icon={<LoadFlowIcon sx={{ fontSize: 15 }} />}
                                    label={loadFlowStatusMeta[loadFlowStatus].label}
                                    sx={{
                                      bgcolor: `${loadFlowStatusMeta[loadFlowStatus].color}22`,
                                      color: loadFlowStatusMeta[loadFlowStatus].color,
                                    }}
                                  />
                                  <Chip
                                    size="small"
                                    label={`Load-in ${formatDateTimeShort(loadFlow.loadInAt)}`}
                                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.84)' }}
                                  />
                                  <Chip
                                    size="small"
                                    label={`Load-out ${formatDateTimeShort(loadFlow.loadOutAt)}`}
                                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.84)' }}
                                  />
                                </Box>

                                {isEditingLoadFlow ? (
                                  <Box
                                    sx={{
                                      mt: 1,
                                      display: 'grid',
                                      gridTemplateColumns: {
                                        xs: '1fr',
                                        md: 'repeat(2, minmax(0, 1fr))',
                                        xl: 'repeat(3, minmax(0, 1fr))',
                                      },
                                      gap: 1,
                                      '@media (min-width: 2048px)': {
                                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                        gap: 1.2,
                                      },
                                      '@media (min-width: 3840px)': {
                                        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                                        gap: 1.4,
                                      },
                                      '@media (min-width: 5120px)': {
                                        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                                        gap: 1.6,
                                      },
                                    }}
                                  >
                                    <TextField
                                      size="small"
                                      type="datetime-local"
                                      label="Load-in"
                                      InputLabelProps={{ shrink: true }}
                                      value={loadFlowDraft.loadInAt}
                                      onChange={(event) => handleLoadFlowDraftChange(location.id, 'loadInAt', event.target.value)}
                                      sx={{
                                        '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' } },
                                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                      }}
                                    />
                                    <TextField
                                      size="small"
                                      type="datetime-local"
                                      label="Start opptak"
                                      InputLabelProps={{ shrink: true }}
                                      value={loadFlowDraft.shootStartAt}
                                      onChange={(event) => handleLoadFlowDraftChange(location.id, 'shootStartAt', event.target.value)}
                                      sx={{
                                        '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' } },
                                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                      }}
                                    />
                                    <TextField
                                      size="small"
                                      type="datetime-local"
                                      label="Wrap"
                                      InputLabelProps={{ shrink: true }}
                                      value={loadFlowDraft.wrapAt}
                                      onChange={(event) => handleLoadFlowDraftChange(location.id, 'wrapAt', event.target.value)}
                                      sx={{
                                        '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' } },
                                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                      }}
                                    />
                                    <TextField
                                      size="small"
                                      type="datetime-local"
                                      label="Load-out"
                                      InputLabelProps={{ shrink: true }}
                                      value={loadFlowDraft.loadOutAt}
                                      onChange={(event) => handleLoadFlowDraftChange(location.id, 'loadOutAt', event.target.value)}
                                      sx={{
                                        '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' } },
                                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                      }}
                                    />
                                    <FormControl size="small">
                                      <InputLabel sx={{ color: 'rgba(255,255,255,0.72)' }}>Status</InputLabel>
                                      <Select
                                        value={loadFlowDraft.status}
                                        label="Status"
                                        onChange={(event) =>
                                          handleLoadFlowDraftChange(location.id, 'status', String(event.target.value))
                                        }
                                        sx={{
                                          color: '#fff',
                                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                                        }}
                                      >
                                        <MenuItem value="planned">Planlagt</MenuItem>
                                        <MenuItem value="ready">Klar</MenuItem>
                                        <MenuItem value="in_progress">Pågår</MenuItem>
                                        <MenuItem value="completed">Ferdig</MenuItem>
                                      </Select>
                                    </FormControl>
                                    <TextField
                                      size="small"
                                      label="Flow-notat"
                                      value={loadFlowDraft.notes}
                                      onChange={(event) => handleLoadFlowDraftChange(location.id, 'notes', event.target.value)}
                                      sx={{
                                        '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' } },
                                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                      }}
                                    />
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', gridColumn: { xs: '1 / -1' } }}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                                        onClick={() => void handleSaveLoadFlow(location)}
                                        disabled={isSavingLoadFlow}
                                        sx={{ textTransform: 'none', bgcolor: ROLE_ROOM_COLORS.secondary, '&:hover': { bgcolor: '#06b6d4' } }}
                                      >
                                        {isSavingLoadFlow ? 'Lagrer...' : 'Lagre flow'}
                                      </Button>
                                      <Button
                                        size="small"
                                        onClick={() => handleCancelLoadFlowEditing(location)}
                                        disabled={isSavingLoadFlow}
                                        sx={{ color: 'rgba(255,255,255,0.75)', textTransform: 'none' }}
                                      >
                                        Avbryt
                                      </Button>
                                    </Box>
                                  </Box>
                                ) : null}
                              </Collapse>
                            </Box>

                            <Box
                              sx={{
                                mt: 1.1,
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(192,132,252,0.08)',
                                border: '1px solid rgba(192,132,252,0.26)',
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <LinkIcon sx={{ fontSize: 16, color: '#d8b4fe' }} />
                                  <Typography sx={{ color: '#e9d5ff', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                    Scene-kobling (crew/callback/shot/utstyr/storyboard)
                                  </Typography>
                                  {consistencySection === 'sceneLinks' ? (
                                    <Chip
                                      size="small"
                                      icon={<ExploreIcon sx={{ fontSize: 14 }} />}
                                      label="Fra konsistenssjekk"
                                      sx={{
                                        bgcolor: 'rgba(251,191,36,0.22)',
                                        color: '#fde68a',
                                        border: '1px solid rgba(251,191,36,0.45)',
                                      }}
                                    />
                                  ) : null}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      isEditingSceneLinks
                                        ? handleCancelSceneLinkEditing(location)
                                        : handleToggleSceneLinkEditing(location)
                                    }
                                    sx={{ color: ROLE_ROOM_COLORS.accent, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {isEditingSceneLinks ? 'Lukk kobling' : 'Koble scener'}
                                  </Button>
                                  <Button
                                    size="small"
                                    endIcon={sceneLinksExpanded ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => toggleProSection(location.id, 'sceneLinks')}
                                    sx={{ color: ROLE_ROOM_COLORS.accent, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {sceneLinksExpanded ? 'Skjul' : 'Vis'}
                                  </Button>
                                </Box>
                              </Box>

                              <Collapse in={sceneLinksExpanded}>
                                <Box sx={{ mt: 1, display: 'flex', gap: 0.65, flexWrap: 'wrap' }}>
                                  <Chip size="small" icon={<TimelineIcon sx={{ fontSize: 15 }} />} label={`${linkedSceneIds.length} scener`} sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }} />
                                  <Chip size="small" icon={<TimelineIcon sx={{ fontSize: 15 }} />} label={`${linkedSceneSummary.shots} shots`} sx={{ bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9' }} />
                                  <Chip size="small" icon={<CallbackIcon sx={{ fontSize: 15 }} />} label={`${linkedSceneSummary.callbacks} callbacks`} sx={{ bgcolor: 'rgba(251,191,36,0.2)', color: '#fcd34d' }} />
                                  <Chip size="small" icon={<CrewLinkIcon sx={{ fontSize: 15 }} />} label={`${linkedSceneSummary.crew} crew-touchpoints`} sx={{ bgcolor: 'rgba(134,239,172,0.18)', color: '#86efac' }} />
                                  <Chip size="small" icon={<EquipmentIcon sx={{ fontSize: 15 }} />} label={`${linkedSceneSummary.equipment} utstyr`} sx={{ bgcolor: 'rgba(248,113,113,0.18)', color: '#fca5a5' }} />
                                  <Chip size="small" icon={<StoryboardIcon sx={{ fontSize: 15 }} />} label={`${linkedSceneSummary.storyboard} storyboard`} sx={{ bgcolor: 'rgba(192,132,252,0.2)', color: '#d8b4fe' }} />
                                </Box>

                                {isEditingSceneLinks ? (
                                  <Box sx={{ mt: 1, maxHeight: 230, overflow: 'auto', pr: 0.5 }}>
                                    {proSceneOptions.length === 0 ? (
                                      <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.8rem' }}>
                                        Ingen scener funnet i prosjektet ennå.
                                      </Typography>
                                    ) : (
                                      <Stack spacing={0.75}>
                                        {proSceneOptions.map((scene) => {
                                          const selected = sceneDraftIds.includes(scene.id);
                                          const insight = proSceneInsightsById[scene.id];
                                          const storyboardCoverage =
                                            insight && insight.shotCount > 0
                                              ? Math.round((insight.storyboardCount / insight.shotCount) * 100)
                                              : 0;
                                          return (
                                            <Box
                                              key={scene.id}
                                              sx={{
                                                p: 0.8,
                                                borderRadius: 1.25,
                                                bgcolor: selected ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${selected ? 'rgba(168,85,247,0.38)' : 'rgba(255,255,255,0.16)'}`,
                                              }}
                                            >
                                              <FormControlLabel
                                                control={
                                                  <Checkbox
                                                    checked={selected}
                                                    onChange={() => handleToggleSceneLink(location.id, scene.id)}
                                                    sx={{ color: 'rgba(255,255,255,0.72)', '&.Mui-checked': { color: ROLE_ROOM_COLORS.accent } }}
                                                  />
                                                }
                                                label={
                                                  <Box>
                                                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.8rem' }}>
                                                      {scene.label}
                                                    </Typography>
                                                    <Box sx={{ mt: 0.35, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                      <Chip size="small" label={`${insight?.shotCount ?? 0} shots`} sx={{ bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9' }} />
                                                      <Chip size="small" label={`${insight?.callbackCount ?? 0} callback`} sx={{ bgcolor: 'rgba(251,191,36,0.2)', color: '#fcd34d' }} />
                                                      <Chip size="small" label={`${insight?.equipment.length ?? 0} utstyr`} sx={{ bgcolor: 'rgba(248,113,113,0.18)', color: '#fca5a5' }} />
                                                      <Chip size="small" label={`Storyboard ${storyboardCoverage}%`} sx={{ bgcolor: 'rgba(192,132,252,0.2)', color: '#d8b4fe' }} />
                                                    </Box>
                                                  </Box>
                                                }
                                                sx={{ alignItems: 'flex-start', m: 0 }}
                                              />
                                            </Box>
                                          );
                                        })}
                                      </Stack>
                                    )}
                                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                      <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                                        onClick={() => void handleSaveSceneLinks(location)}
                                        disabled={isSavingSceneLinks}
                                        sx={{
                                          textTransform: 'none',
                                          bgcolor: ROLE_ROOM_COLORS.accent,
                                          '&:hover': { bgcolor: ROLE_ROOM_COLORS.accentStrong },
                                        }}
                                      >
                                        {isSavingSceneLinks ? 'Lagrer...' : 'Lagre scene-kobling'}
                                      </Button>
                                      <Button
                                        size="small"
                                        onClick={() => handleCancelSceneLinkEditing(location)}
                                        disabled={isSavingSceneLinks}
                                        sx={{ color: 'rgba(255,255,255,0.75)', textTransform: 'none' }}
                                      >
                                        Avbryt
                                      </Button>
                                    </Box>
                                  </Box>
                                ) : (
                                  <Box sx={{ mt: 1 }}>
                                    {linkedSceneInsights.length === 0 ? (
                                      <Typography sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.78rem' }}>
                                        Ingen scener koblet til denne lokasjonen ennå.
                                      </Typography>
                                    ) : (
                                      <Stack spacing={0.7}>
                                        {linkedSceneInsights.slice(0, 4).map((scene) => {
                                          const storyboardCoverage =
                                            scene.shotCount > 0 ? Math.round((scene.storyboardCount / scene.shotCount) * 100) : 0;
                                          return (
                                            <Box
                                              key={scene.sceneId}
                                              sx={{
                                                p: 0.8,
                                                borderRadius: 1.2,
                                                bgcolor: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.14)',
                                              }}
                                            >
                                              <Typography sx={{ color: '#fff', fontSize: '0.79rem', fontWeight: 600 }}>
                                                {scene.sceneLabel}
                                              </Typography>
                                              <Box sx={{ mt: 0.45, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                <Chip size="small" label={`${scene.shotListCount} shotlists`} sx={{ bgcolor: 'rgba(34,211,238,0.15)', color: '#67e8f9' }} />
                                                <Chip size="small" label={`${scene.callbackCount} callbacks`} sx={{ bgcolor: 'rgba(251,191,36,0.2)', color: '#fcd34d' }} />
                                                <Chip size="small" label={`${scene.crewTouchpoints} crew`} sx={{ bgcolor: 'rgba(134,239,172,0.18)', color: '#86efac' }} />
                                                <Chip size="small" label={`Storyboard ${storyboardCoverage}%`} sx={{ bgcolor: 'rgba(192,132,252,0.2)', color: '#d8b4fe' }} />
                                              </Box>
                                              {scene.equipment.length > 0 ? (
                                                <Box sx={{ mt: 0.5, display: 'flex', gap: 0.45, flexWrap: 'wrap' }}>
                                                  {scene.equipment.slice(0, 4).map((item) => (
                                                    <Chip
                                                      key={`${scene.sceneId}-${item}`}
                                                      size="small"
                                                      icon={<EquipmentIcon sx={{ fontSize: 14 }} />}
                                                      label={item}
                                                      sx={{ bgcolor: 'rgba(248,113,113,0.16)', color: '#fca5a5' }}
                                                    />
                                                  ))}
                                                  {scene.equipment.length > 4 ? (
                                                    <Chip
                                                      size="small"
                                                      label={`+${scene.equipment.length - 4}`}
                                                      sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}
                                                    />
                                                  ) : null}
                                                </Box>
                                              ) : null}
                                            </Box>
                                          );
                                        })}
                                      </Stack>
                                    )}
                                  </Box>
                                )}
                              </Collapse>
                            </Box>

                            <Box
                              sx={{
                                mt: 1.1,
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(34,211,238,0.08)',
                                border: '1px solid rgba(34,211,238,0.24)',
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 1,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <ImageIcon sx={{ fontSize: 16, color: '#67e8f9' }} />
                                  <Typography
                                    sx={{
                                      color: '#67e8f9',
                                      fontSize: '0.74rem',
                                      textTransform: 'uppercase',
                                      fontWeight: 700,
                                    }}
                                  >
                                    Lokasjonsbilder + storyboard
                                  </Typography>
                                  {consistencySection === 'media' ? (
                                    <Chip
                                      size="small"
                                      icon={<ExploreIcon sx={{ fontSize: 14 }} />}
                                      label="Fra konsistenssjekk"
                                      sx={{
                                        bgcolor: 'rgba(251,191,36,0.22)',
                                        color: '#fde68a',
                                        border: '1px solid rgba(251,191,36,0.45)',
                                      }}
                                    />
                                  ) : null}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      isEditingMedia ? handleCancelMediaEditing(location) : handleToggleMediaEditing(location)
                                    }
                                    sx={{ color: ROLE_ROOM_COLORS.secondary, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {isEditingMedia ? 'Lukk media' : 'Rediger media'}
                                  </Button>
                                  <Button
                                    size="small"
                                    endIcon={mediaExpanded ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => toggleProSection(location.id, 'media')}
                                    sx={{ color: ROLE_ROOM_COLORS.secondary, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {mediaExpanded ? 'Skjul' : 'Vis'}
                                  </Button>
                                </Box>
                              </Box>

                              <Collapse in={mediaExpanded}>
                              <Box sx={{ mt: 1, display: 'flex', gap: 0.65, flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  icon={<ImageIcon sx={{ fontSize: 15 }} />}
                                  label={`${locationMediaImages.length} lokasjonsbilder`}
                                  sx={{ bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9' }}
                                />
                                <Chip
                                  size="small"
                                  icon={<StoryboardIcon sx={{ fontSize: 15 }} />}
                                  label={`${storyboardMediaImages.length} storyboard-bilder`}
                                  sx={{ bgcolor: 'rgba(192,132,252,0.2)', color: '#d8b4fe' }}
                                />
                                {mediaDraft.storyboardSceneIds.length > 0 ? (
                                  <Chip
                                    size="small"
                                    icon={<LinkIcon sx={{ fontSize: 15 }} />}
                                    label={`${mediaDraft.storyboardSceneIds.length} scener valgt`}
                                    sx={{ bgcolor: 'rgba(134,239,172,0.18)', color: '#86efac' }}
                                  />
                                ) : null}
                              </Box>

                              {isEditingMedia ? (
                                <Box
                                  sx={{
                                    mt: 1,
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                                    gap: 1,
                                    '@media (min-width: 2048px)': { gap: 1.25 },
                                    '@media (min-width: 3840px)': { gap: 1.5 },
                                    '@media (min-width: 5120px)': { gap: 1.8 },
                                  }}
                                >
                                  <Box
                                    sx={{
                                      p: 0.9,
                                      borderRadius: 1.4,
                                      bgcolor: 'rgba(255,255,255,0.05)',
                                      border: '1px solid rgba(255,255,255,0.14)',
                                    }}
                                  >
                                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>
                                      Lokasjonsbilder
                                    </Typography>
                                    <Box
                                      sx={{
                                        mt: 0.75,
                                        display: 'grid',
                                        gridTemplateColumns: {
                                          xs: '1fr',
                                          md: 'repeat(2, minmax(0, 1fr))',
                                          xl: 'repeat(3, minmax(0, 1fr))',
                                        },
                                        gap: 0.75,
                                        '@media (min-width: 2048px)': { gap: 0.9 },
                                        '@media (min-width: 3840px)': { gap: 1.05 },
                                      }}
                                    >
                                      <TextField
                                        size="small"
                                        label="Bilde-URL"
                                        value={mediaDraft.locationImageUrlInput}
                                        onChange={(event) =>
                                          handleMediaDraftFieldChange(
                                            location.id,
                                            'locationImageUrlInput',
                                            event.target.value
                                          )
                                        }
                                        sx={{
                                          '& .MuiOutlinedInput-root': {
                                            color: '#fff',
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                                          },
                                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                        }}
                                      />
                                      <TextField
                                        size="small"
                                        label="Bildetekst"
                                        value={mediaDraft.locationImageCaptionInput}
                                        onChange={(event) =>
                                          handleMediaDraftFieldChange(
                                            location.id,
                                            'locationImageCaptionInput',
                                            event.target.value
                                          )
                                        }
                                        sx={{
                                          '& .MuiOutlinedInput-root': {
                                            color: '#fff',
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                                          },
                                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                        }}
                                      />
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 0.75,
                                          flexWrap: 'wrap',
                                          gridColumn: { xs: '1 / -1' },
                                        }}
                                      >
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          startIcon={<AddPhotoIcon sx={{ fontSize: 15 }} />}
                                          onClick={() => handleAddMediaFromUrl(location.id, 'location')}
                                          sx={{ textTransform: 'none', color: '#67e8f9', borderColor: 'rgba(34,211,238,0.45)' }}
                                        >
                                          Legg til URL
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          component="label"
                                          startIcon={<UploadFileIcon sx={{ fontSize: 15 }} />}
                                          sx={{ textTransform: 'none', color: '#67e8f9', borderColor: 'rgba(34,211,238,0.45)' }}
                                        >
                                          Last opp bilde
                                          <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(event) => {
                                              const file = event.target.files?.[0];
                                              if (file) {
                                                void handleAddMediaFromFile(location.id, 'location', file);
                                              }
                                              event.target.value = '';
                                            }}
                                          />
                                        </Button>
                                      </Box>
                                    </Box>

                                    <Box
                                      sx={{
                                        mt: 0.9,
                                        display: 'grid',
                                        gridTemplateColumns: {
                                          xs: 'repeat(2, minmax(0, 1fr))',
                                          md: 'repeat(3, minmax(0, 1fr))',
                                          xl: 'repeat(4, minmax(0, 1fr))',
                                        },
                                        gap: 0.7,
                                        '@media (min-width: 2048px)': {
                                          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                                          gap: 0.85,
                                        },
                                        '@media (min-width: 3840px)': {
                                          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                                          gap: 1,
                                        },
                                        '@media (min-width: 5120px)': {
                                          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                                          gap: 1.1,
                                        },
                                      }}
                                    >
                                      {locationMediaImages.length === 0 ? (
                                        <Typography sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.76rem' }}>
                                          Ingen lokasjonsbilder lagt til ennå.
                                        </Typography>
                                      ) : (
                                        locationMediaImages.map((asset, index) => (
                                          <Box
                                            key={`${asset.url}-${index}`}
                                            sx={{
                                              p: 0.55,
                                              borderRadius: 1.2,
                                              bgcolor: 'rgba(255,255,255,0.04)',
                                              border: '1px solid rgba(255,255,255,0.16)',
                                            }}
                                          >
                                            <Box
                                              component="a"
                                              href={asset.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              sx={{
                                                display: 'block',
                                                borderRadius: 1,
                                                overflow: 'hidden',
                                                border: '1px solid rgba(34,211,238,0.28)',
                                              }}
                                            >
                                              <Box
                                                component="img"
                                                src={asset.url}
                                                alt={asset.caption || `Lokasjonsbilde ${index + 1}`}
                                                sx={{
                                                  width: '100%',
                                                  height: 88,
                                                  objectFit: 'cover',
                                                  display: 'block',
                                                }}
                                              />
                                            </Box>
                                            <Box
                                              sx={{
                                                mt: 0.55,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 0.5,
                                              }}
                                            >
                                              <Typography
                                                sx={{
                                                  color: 'rgba(255,255,255,0.84)',
                                                  fontSize: '0.7rem',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {asset.caption || 'Lokasjonsbilde'}
                                              </Typography>
                                              <IconButton
                                                size="small"
                                                onClick={() =>
                                                  handleRemoveMediaAsset(location.id, 'locationImages', asset.id)
                                                }
                                                sx={{ color: '#fca5a5' }}
                                              >
                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                              </IconButton>
                                            </Box>
                                          </Box>
                                        ))
                                      )}
                                    </Box>
                                  </Box>

                                  <Box
                                    sx={{
                                      p: 0.9,
                                      borderRadius: 1.4,
                                      bgcolor: 'rgba(255,255,255,0.05)',
                                      border: '1px solid rgba(255,255,255,0.14)',
                                    }}
                                  >
                                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>
                                      Storyboard-bilder
                                    </Typography>
                                    <Typography sx={{ mt: 0.35, color: 'rgba(255,255,255,0.62)', fontSize: '0.72rem' }}>
                                      Koble bilder til relevante scener for crew, callback, shotlist og utstyr.
                                    </Typography>
                                    <Box sx={{ mt: 0.7 }}>
                                      <Typography sx={{ color: '#d8b4fe', fontSize: '0.7rem', fontWeight: 700 }}>
                                        Scener for neste storyboard-bilde
                                      </Typography>
                                      {mediaSceneOptions.length === 0 ? (
                                        <Typography sx={{ mt: 0.35, color: 'rgba(255,255,255,0.58)', fontSize: '0.74rem' }}>
                                          Koble scener til lokasjonen først.
                                        </Typography>
                                      ) : (
                                        <Box sx={{ mt: 0.5, display: 'flex', gap: 0.45, flexWrap: 'wrap' }}>
                                          {mediaSceneOptions.map((scene) => {
                                            const selected = mediaDraft.storyboardSceneIds.includes(scene.id);
                                            return (
                                              <Chip
                                                key={`${location.id}-draft-scene-${scene.id}`}
                                                size="small"
                                                clickable
                                                onClick={() =>
                                                  handleToggleStoryboardSceneDraftSelection(location.id, scene.id)
                                                }
                                                label={scene.label}
                                                sx={{
                                                  bgcolor: selected ? 'rgba(168,85,247,0.24)' : 'rgba(255,255,255,0.08)',
                                                  color: selected ? '#e9d5ff' : 'rgba(255,255,255,0.78)',
                                                  border: `1px solid ${
                                                    selected ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.18)'
                                                  }`,
                                                }}
                                              />
                                            );
                                          })}
                                          {mediaSceneOverflowCount > 0 ? (
                                            <Chip
                                              size="small"
                                              label={`+${mediaSceneOverflowCount}`}
                                              sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.78)' }}
                                            />
                                          ) : null}
                                        </Box>
                                      )}
                                    </Box>
                                    <Box
                                      sx={{
                                        mt: 0.75,
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                                        gap: 0.75,
                                      }}
                                    >
                                      <TextField
                                        size="small"
                                        label="Storyboard URL"
                                        value={mediaDraft.storyboardImageUrlInput}
                                        onChange={(event) =>
                                          handleMediaDraftFieldChange(
                                            location.id,
                                            'storyboardImageUrlInput',
                                            event.target.value
                                          )
                                        }
                                        sx={{
                                          '& .MuiOutlinedInput-root': {
                                            color: '#fff',
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                                          },
                                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                        }}
                                      />
                                      <TextField
                                        size="small"
                                        label="Storyboard-tekst"
                                        value={mediaDraft.storyboardImageCaptionInput}
                                        onChange={(event) =>
                                          handleMediaDraftFieldChange(
                                            location.id,
                                            'storyboardImageCaptionInput',
                                            event.target.value
                                          )
                                        }
                                        sx={{
                                          '& .MuiOutlinedInput-root': {
                                            color: '#fff',
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                                          },
                                          '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                        }}
                                      />
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 0.75,
                                          flexWrap: 'wrap',
                                          gridColumn: { xs: '1 / -1' },
                                        }}
                                      >
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          startIcon={<AddPhotoIcon sx={{ fontSize: 15 }} />}
                                          onClick={() => handleAddMediaFromUrl(location.id, 'storyboard')}
                                          sx={{ textTransform: 'none', color: '#d8b4fe', borderColor: 'rgba(168,85,247,0.45)' }}
                                        >
                                          Legg til URL
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          component="label"
                                          startIcon={<UploadFileIcon sx={{ fontSize: 15 }} />}
                                          sx={{ textTransform: 'none', color: '#d8b4fe', borderColor: 'rgba(168,85,247,0.45)' }}
                                        >
                                          Last opp bilde
                                          <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(event) => {
                                              const file = event.target.files?.[0];
                                              if (file) {
                                                void handleAddMediaFromFile(location.id, 'storyboard', file);
                                              }
                                              event.target.value = '';
                                            }}
                                          />
                                        </Button>
                                      </Box>
                                    </Box>

                                    <Box
                                      sx={{
                                        mt: 0.9,
                                        display: 'grid',
                                        gridTemplateColumns: {
                                          xs: 'repeat(2, minmax(0, 1fr))',
                                          md: 'repeat(3, minmax(0, 1fr))',
                                        },
                                        gap: 0.7,
                                      }}
                                    >
                                      {storyboardMediaImages.length === 0 ? (
                                        <Typography sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.76rem' }}>
                                          Ingen storyboard-bilder lagt til ennå.
                                        </Typography>
                                      ) : (
                                        storyboardMediaImages.map((asset, index) => {
                                          const selectedSceneIds = normalizeSceneIds(asset.sceneIds);
                                          return (
                                            <Box
                                              key={`${asset.url}-${index}`}
                                              sx={{
                                                p: 0.55,
                                                borderRadius: 1.2,
                                                bgcolor: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.16)',
                                              }}
                                            >
                                              <Box
                                                component="a"
                                                href={asset.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                sx={{
                                                  display: 'block',
                                                  borderRadius: 1,
                                                  overflow: 'hidden',
                                                  border: '1px solid rgba(168,85,247,0.35)',
                                                }}
                                              >
                                                <Box
                                                  component="img"
                                                  src={asset.url}
                                                  alt={asset.caption || `Storyboard ${index + 1}`}
                                                  sx={{
                                                    width: '100%',
                                                    height: 88,
                                                    objectFit: 'cover',
                                                    display: 'block',
                                                  }}
                                                />
                                              </Box>
                                              <Box
                                                sx={{
                                                  mt: 0.55,
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  alignItems: 'center',
                                                  gap: 0.5,
                                                }}
                                              >
                                                <Typography
                                                  sx={{
                                                    color: 'rgba(255,255,255,0.84)',
                                                    fontSize: '0.7rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                  {asset.caption || 'Storyboard'}
                                                </Typography>
                                                <IconButton
                                                  size="small"
                                                  onClick={() =>
                                                    handleRemoveMediaAsset(location.id, 'storyboardImages', asset.id)
                                                  }
                                                  sx={{ color: '#fca5a5' }}
                                                >
                                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                              </Box>
                                              {mediaSceneOptions.length > 0 ? (
                                                <Box sx={{ mt: 0.55, display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                                  {mediaSceneOptions.map((scene) => {
                                                    const selected = selectedSceneIds.includes(scene.id);
                                                    return (
                                                      <Chip
                                                        key={`${asset.id}-${scene.id}`}
                                                        size="small"
                                                        clickable
                                                        onClick={() =>
                                                          handleToggleMediaStoryboardScene(
                                                            location.id,
                                                            asset.id,
                                                            scene.id
                                                          )
                                                        }
                                                        label={scene.label}
                                                        sx={{
                                                          bgcolor: selected
                                                            ? 'rgba(168,85,247,0.24)'
                                                            : 'rgba(255,255,255,0.08)',
                                                          color: selected
                                                            ? '#e9d5ff'
                                                            : 'rgba(255,255,255,0.76)',
                                                          border: `1px solid ${
                                                            selected
                                                              ? 'rgba(168,85,247,0.5)'
                                                              : 'rgba(255,255,255,0.16)'
                                                          }`,
                                                        }}
                                                      />
                                                    );
                                                  })}
                                                  {mediaSceneOverflowCount > 0 ? (
                                                    <Chip
                                                      size="small"
                                                      label={`+${mediaSceneOverflowCount}`}
                                                      sx={{
                                                        bgcolor: 'rgba(255,255,255,0.1)',
                                                        color: 'rgba(255,255,255,0.78)',
                                                      }}
                                                    />
                                                  ) : null}
                                                </Box>
                                              ) : null}
                                            </Box>
                                          );
                                        })
                                      )}
                                    </Box>
                                  </Box>

                                  <Box
                                    sx={{
                                      gridColumn: { xs: '1 / -1' },
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.75,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <Button
                                      size="small"
                                      variant="contained"
                                      startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                                      onClick={() => void handleSaveMedia(location)}
                                      disabled={isSavingMedia}
                                      sx={{
                                        textTransform: 'none',
                                        bgcolor: ROLE_ROOM_COLORS.secondary,
                                        '&:hover': { bgcolor: '#06b6d4' },
                                      }}
                                    >
                                      {isSavingMedia ? 'Lagrer...' : 'Lagre media'}
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => handleCancelMediaEditing(location)}
                                      disabled={isSavingMedia}
                                      sx={{ color: 'rgba(255,255,255,0.75)', textTransform: 'none' }}
                                    >
                                      Avbryt
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <Box
                                  sx={{
                                    mt: 1,
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                                    gap: 1,
                                  }}
                                >
                                  <Box sx={{ p: 0.8, borderRadius: 1.2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>
                                      Lokasjonsbilder
                                    </Typography>
                                    {locationMediaImages.length === 0 ? (
                                      <Typography sx={{ mt: 0.45, color: 'rgba(255,255,255,0.58)', fontSize: '0.74rem' }}>
                                        Ingen lokasjonsbilder lagt inn.
                                      </Typography>
                                    ) : (
                                      <Box sx={{ mt: 0.55, display: 'flex', gap: 0.55, flexWrap: 'wrap' }}>
                                        {locationMediaImages.slice(0, 4).map((asset, index) => (
                                          <Box
                                            key={`${asset.url}-${index}`}
                                            component="a"
                                            href={asset.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            sx={{
                                              width: 72,
                                              height: 52,
                                              borderRadius: 1,
                                              overflow: 'hidden',
                                              border: '1px solid rgba(34,211,238,0.35)',
                                              display: 'block',
                                            }}
                                          >
                                            <Box
                                              component="img"
                                              src={asset.url}
                                              alt={asset.caption || `Lokasjonsbilde ${index + 1}`}
                                              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                            />
                                          </Box>
                                        ))}
                                        {locationMediaImages.length > 4 ? (
                                          <Chip
                                            size="small"
                                            label={`+${locationMediaImages.length - 4}`}
                                            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                                          />
                                        ) : null}
                                      </Box>
                                    )}
                                  </Box>

                                  <Box sx={{ p: 0.8, borderRadius: 1.2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.14)' }}>
                                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>
                                      Storyboard-bilder
                                    </Typography>
                                    {storyboardMediaImages.length === 0 ? (
                                      <Typography sx={{ mt: 0.45, color: 'rgba(255,255,255,0.58)', fontSize: '0.74rem' }}>
                                        Ingen storyboard-bilder lagt inn.
                                      </Typography>
                                    ) : (
                                      <Stack spacing={0.7} sx={{ mt: 0.55 }}>
                                        {storyboardMediaImages.slice(0, 3).map((asset, index) => {
                                          const labels = normalizeSceneIds(asset.sceneIds)
                                            .slice(0, 3)
                                            .map((sceneId) => proSceneLabelById.get(sceneId) ?? `Scene ${sceneId}`);
                                          return (
                                            <Box
                                              key={`${asset.url}-${index}`}
                                              sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.55,
                                              }}
                                            >
                                              <Box
                                                component="a"
                                                href={asset.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                sx={{
                                                  width: 72,
                                                  height: 52,
                                                  borderRadius: 1,
                                                  overflow: 'hidden',
                                                  border: '1px solid rgba(168,85,247,0.4)',
                                                  display: 'block',
                                                  flexShrink: 0,
                                                }}
                                              >
                                                <Box
                                                  component="img"
                                                  src={asset.url}
                                                  alt={asset.caption || `Storyboard ${index + 1}`}
                                                  sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    display: 'block',
                                                  }}
                                                />
                                              </Box>
                                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography
                                                  sx={{
                                                    color: 'rgba(255,255,255,0.86)',
                                                    fontSize: '0.72rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                  {asset.caption || 'Storyboard'}
                                                </Typography>
                                                <Box sx={{ mt: 0.35, display: 'flex', gap: 0.35, flexWrap: 'wrap' }}>
                                                  {labels.length > 0 ? (
                                                    labels.map((label) => (
                                                      <Chip
                                                        key={`${asset.id}-${label}`}
                                                        size="small"
                                                        label={label}
                                                        sx={{
                                                          bgcolor: 'rgba(168,85,247,0.2)',
                                                          color: '#e9d5ff',
                                                        }}
                                                      />
                                                    ))
                                                  ) : (
                                                    <Chip
                                                      size="small"
                                                      label="Ingen scene-kobling"
                                                      sx={{
                                                        bgcolor: 'rgba(255,255,255,0.08)',
                                                        color: 'rgba(255,255,255,0.72)',
                                                      }}
                                                    />
                                                  )}
                                                </Box>
                                              </Box>
                                            </Box>
                                          );
                                        })}
                                        {storyboardMediaImages.length > 3 ? (
                                          <Chip
                                            size="small"
                                            label={`+${storyboardMediaImages.length - 3} flere storyboard-bilder`}
                                            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                                          />
                                        ) : null}
                                      </Stack>
                                    )}
                                  </Box>
                                </Box>
                              )}
                              </Collapse>
                            </Box>

                            <Box
                              sx={{
                                mt: 1.1,
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'rgba(168,85,247,0.08)',
                                border: '1px solid rgba(168,85,247,0.24)',
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <Typography sx={{ color: '#e9d5ff', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                  Kontaktinfo
                                </Typography>
                                {consistencySection === 'contact' ? (
                                  <Chip
                                    size="small"
                                    icon={<ExploreIcon sx={{ fontSize: 14 }} />}
                                    label="Fra konsistenssjekk"
                                    sx={{
                                      bgcolor: 'rgba(251,191,36,0.22)',
                                      color: '#fde68a',
                                      border: '1px solid rgba(251,191,36,0.45)',
                                    }}
                                  />
                                ) : null}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      isEditingProContact ? handleCancelProContactEditing(location) : handleToggleProContactEditing(location)
                                    }
                                    sx={{ color: ROLE_ROOM_COLORS.accent, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {isEditingProContact ? 'Lukk' : 'Rediger kontakt'}
                                  </Button>
                                  <Button
                                    size="small"
                                    endIcon={contactExpanded ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => toggleProSection(location.id, 'contact')}
                                    sx={{ color: ROLE_ROOM_COLORS.accent, textTransform: 'none', minWidth: 0, px: 1 }}
                                  >
                                    {contactExpanded ? 'Skjul' : 'Vis'}
                                  </Button>
                                </Box>
                              </Box>

                              <Collapse in={contactExpanded}>
                              {isEditingProContact ? (
                                <Box
                                  sx={{
                                    mt: 1,
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                                    gap: 1,
                                  }}
                                >
                                  <TextField
                                    size="small"
                                    label="Navn"
                                    value={proContactDraft.name}
                                    onChange={(event) => handleProContactDraftChange(location.id, 'name', event.target.value)}
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        color: '#fff',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                                      },
                                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                    }}
                                  />
                                  <TextField
                                    size="small"
                                    label="Telefon"
                                    value={proContactDraft.phone}
                                    onChange={(event) => handleProContactDraftChange(location.id, 'phone', event.target.value)}
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        color: '#fff',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                                      },
                                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                    }}
                                  />
                                  <TextField
                                    size="small"
                                    type="email"
                                    label="E-post"
                                    value={proContactDraft.email}
                                    onChange={(event) => handleProContactDraftChange(location.id, 'email', event.target.value)}
                                    sx={{
                                      '& .MuiOutlinedInput-root': {
                                        color: '#fff',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                                      },
                                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.72)' },
                                    }}
                                  />
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', gridColumn: { xs: '1 / -1' } }}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                                      onClick={() => handleSaveProContact(location)}
                                      disabled={isSavingProContact}
                                      sx={{
                                        textTransform: 'none',
                                        bgcolor: ROLE_ROOM_COLORS.accent,
                                        '&:hover': { bgcolor: ROLE_ROOM_COLORS.accentStrong },
                                      }}
                                    >
                                      {isSavingProContact ? 'Lagrer...' : 'Lagre kontakt'}
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => handleCancelProContactEditing(location)}
                                      disabled={isSavingProContact}
                                      sx={{ color: 'rgba(255,255,255,0.75)', textTransform: 'none' }}
                                    >
                                      Avbryt
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <Box sx={{ mt: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                  {proContactName ? (
                                    <Chip
                                      size="small"
                                      icon={<PersonIcon sx={{ fontSize: 15 }} />}
                                      label={proContactName}
                                      sx={{ bgcolor: 'rgba(77,208,225,0.18)', color: '#67e8f9' }}
                                    />
                                  ) : null}
                                  {proContactPhone ? (
                                    <Chip
                                      size="small"
                                      icon={<PhoneIcon sx={{ fontSize: 15 }} />}
                                      label={proContactPhone}
                                      sx={{ bgcolor: 'rgba(192,132,252,0.22)', color: '#e9d5ff' }}
                                    />
                                  ) : null}
                                  {proContactEmail ? (
                                    <Chip
                                      size="small"
                                      icon={<EmailIcon sx={{ fontSize: 15 }} />}
                                      label={proContactEmail}
                                      sx={{ bgcolor: 'rgba(34,211,238,0.16)', color: '#67e8f9' }}
                                    />
                                  ) : null}
                                  {!proContactName && !proContactPhone && !proContactEmail ? (
                                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.76rem' }}>
                                      Ingen kontaktinfo lagt inn.
                                    </Typography>
                                  ) : null}
                                </Box>
                              )}
                              </Collapse>
                            </Box>

                            <Box sx={{ mt: 1.1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                              <Chip size="small" icon={<TimelineIcon />} label={`${metric?.shotsCount ?? 0} shots`} sx={{ bgcolor: 'rgba(34,211,238,0.18)', color: '#67e8f9' }} />
                              {(metric?.missingTechnicalRoles ?? []).slice(0, 2).map((role) => (
                                <Chip key={role} size="small" label={getRoleLabel(role)} sx={{ bgcolor: 'rgba(248,113,113,0.18)', color: '#fca5a5' }} />
                              ))}
                              <Button
                                size="small"
                                onClick={() => {
                                  if (hasCoordinates) {
                                    setActiveMapLocationId(location.id);
                                  }
                                }}
                                disabled={!hasCoordinates}
                                sx={{
                                  color: hasCoordinates ? ROLE_ROOM_COLORS.secondary : 'rgba(255,255,255,0.35)',
                                  textTransform: 'none',
                                }}
                              >
                                Vis i kart
                              </Button>
                              <Button size="small" onClick={() => handleOpenDialog(location)} sx={{ color: ROLE_ROOM_COLORS.accent, textTransform: 'none' }}>
                                Rediger
                              </Button>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {proFilteredAndSortedLocations.length > proVisibleLocations.length && (
                      <Button variant="outlined" onClick={() => setProPageSize((current) => current + 24)}>
                        Last inn flere ({proVisibleLocations.length}/{proFilteredAndSortedLocations.length})
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>

            <Stack spacing={{ xs: 1.5, sm: 2 }}>
              {projectContextLoading ? (
                <Card sx={{ bgcolor: ROLE_ROOM_COLORS.panel, border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}>
                  <CardContent>
                    <Skeleton variant="text" sx={{ bgcolor: 'rgba(255,255,255,0.15)' }} />
                    <Skeleton variant="rectangular" height={140} sx={{ bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }} />
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card sx={{ bgcolor: ROLE_ROOM_COLORS.panel, border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1.25 }}>Crew + ShotList kobling</Typography>
                      <Stack spacing={1}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.76rem' }}>Teknisk crew tilgjengelig</Typography>
                          <Typography sx={{ color: '#67e8f9', fontWeight: 800, fontSize: '1.1rem' }}>{technicalCrewPool.length}</Typography>
                        </Box>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.76rem' }}>Shots koblet til lokasjoner</Typography>
                          <Typography sx={{ color: '#d8b4fe', fontWeight: 800, fontSize: '1.1rem' }}>{allShots.filter((shot) => shot.locationId).length}</Typography>
                        </Box>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)' }}>
                          <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.76rem' }}>Lokasjoner med tekniske hull</Typography>
                          <Typography sx={{ color: '#fca5a5', fontWeight: 800, fontSize: '1.1rem' }}>
                            {locationProMetrics.filter((metric) => metric.missingTechnicalRoles.length > 0).length}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card sx={{ bgcolor: ROLE_ROOM_COLORS.panel, border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}>
                    <CardContent>
                      <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1.25 }}>Budsjett-intelligens</Typography>
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ color: ROLE_ROOM_COLORS.mutedText, fontSize: '0.8rem' }}>Prosjektbudsjett</Typography>
                          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                            {new Intl.NumberFormat('nb-NO').format(projectContext?.budget ?? 0)} {projectContext?.currency || 'NOK'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ color: ROLE_ROOM_COLORS.mutedText, fontSize: '0.8rem' }}>Estimert kost (scope)</Typography>
                          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                            {new Intl.NumberFormat('nb-NO').format(
                              proFilteredAndSortedLocations.reduce(
                                (sum, location) => sum + (locationMetricsById[location.id]?.estimatedCost ?? 0),
                                0
                              )
                            )}{' '}
                            kr
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography sx={{ color: ROLE_ROOM_COLORS.mutedText, fontSize: '0.8rem' }}>Over budsjett</Typography>
                          <Typography sx={{ color: '#f87171', fontWeight: 700 }}>{operationalStats.overBudget}</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>

                  <Card sx={{ bgcolor: ROLE_ROOM_COLORS.panel, border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`, borderRadius: 2.5 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>Konsistenssjekk</Typography>
                        <Button size="small" variant="outlined" onClick={handleNormalizeAnnotationColors}>
                          Standardiser farger
                        </Button>
                      </Box>
                      <Stack spacing={0.75}>
                        {consistencyFindings.length === 0 ? (
                          <Typography sx={{ color: '#86efac', fontSize: '0.85rem' }}>Ingen avvik funnet i nåværende datasett.</Typography>
                        ) : (
                          consistencyFindings.slice(0, 6).map((finding, index) => {
                            const location = locations.find((item) => item.id === finding.locationId);
                            return (
                              <Box key={`${finding.locationId}-${index}`} sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.28)' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                  <Typography sx={{ color: '#fecaca', fontWeight: 700, fontSize: '0.78rem' }}>
                                    {location?.name || 'Ukjent lokasjon'}
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<ExploreIcon sx={{ fontSize: 15 }} />}
                                    onClick={() => handleGoToConsistencyFinding(finding)}
                                    sx={{
                                      textTransform: 'none',
                                      borderColor: 'rgba(248,113,113,0.5)',
                                      color: '#fecaca',
                                      '&:hover': {
                                        borderColor: '#fca5a5',
                                        bgcolor: 'rgba(248,113,113,0.16)',
                                      },
                                    }}
                                  >
                                    {finding.ctaLabel}
                                  </Button>
                                </Box>
                                <Typography sx={{ mt: 0.35, color: 'rgba(255,255,255,0.82)', fontSize: '0.76rem' }}>
                                  {finding.warning}
                                </Typography>
                              </Box>
                            );
                          })
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </>
              )}
            </Stack>
          </Box>
        </Stack>
      ) : (
        /* Grid View - Enhanced Responsive cards */
        <Box
          sx={{
            border: `1px solid ${ROLE_ROOM_COLORS.panelBorder}`,
            borderRadius: 2.5,
            bgcolor: 'rgba(16, 12, 36, 0.52)',
            backdropFilter: 'blur(6px)',
            p: { xs: 0.25, sm: 0.5, md: 0.75, lg: 0.875, xl: 1 },
            maxWidth: { xs: '100%', xl: 1880 },
            mx: 'auto',
            '@media (min-width: 2048px)': {
              p: 1.25,
              maxWidth: 2320,
            },
            '@media (min-width: 3840px)': {
              p: 1.75,
              maxWidth: 3400,
            },
            '@media (min-width: 5120px)': {
              p: 2.25,
              maxWidth: 4400,
            },
          }}
        >
        <Box
          role="list"
          aria-label="Liste over lokasjoner"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))',
            },
            gap: { xs: 2.5, sm: 3, md: 3.25, lg: 3.5, xl: 4 },
            alignItems: 'start',
            '@media (min-width: 2048px)': {
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 3.5,
            },
            '@media (min-width: 3840px)': {
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 5,
            },
            '@media (min-width: 5120px)': {
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 5.5,
            },
          }}
        >
          {filteredAndSortedLocations.map((location) => {
            const typeColor = getTypeColor(location.type);
            return (
            <Box
              key={location.id}
              role="listitem"
              sx={{
                display: 'flex',
                p: { xs: 0.25, sm: 0.375, md: 0.5, lg: 0.625 },
                '@media (min-width: 2048px)': { p: 0.5 },
                '@media (min-width: 3840px)': { p: 0.9 },
                '@media (min-width: 5120px)': { p: 1.1 },
              }}
            >
              <Card
                component="article"
                aria-labelledby={`location-name-${location.id}`}
                sx={{
                  width: '100%',
                  height: 'auto',
                  display: 'flex',
                  alignSelf: 'flex-start',
                  flexDirection: 'column',
                  background: selectedIds.has(location.id)
                    ? 'linear-gradient(165deg, rgba(33,24,59,0.96) 0%, rgba(20,16,43,0.94) 100%)'
                    : 'linear-gradient(165deg, rgba(18,15,40,0.9) 0%, rgba(12,10,30,0.9) 100%)',
                  border: selectedIds.has(location.id) ? '1px solid rgba(168,85,247,0.7)' : '1px solid rgba(168,85,247,0.28)',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: selectedIds.has(location.id)
                    ? '0 10px 26px rgba(88,28,135,0.32)'
                    : '0 8px 22px rgba(5,8,20,0.35)',
                  ...focusVisibleStyles,
                  '&:hover': {
                    borderColor: 'rgba(168,85,247,0.72)',
                    boxShadow: '0 14px 32px rgba(88,28,135,0.35)',
                    transform: 'translateY(-3px)',
                  },
                  '@media (min-width: 2048px)': {
                    borderRadius: 2.75,
                  },
                  '@media (min-width: 3840px)': {
                    borderRadius: 3,
                  },
                  '@media (min-width: 5120px)': {
                    borderRadius: 3.25,
                  },
                }}
              >
                {/* Gradient Header */}
                <Box
                  sx={{
                    background: `linear-gradient(135deg, ${typeColor}25 0%, rgba(168,85,247,0.15) 100%)`,
                    borderBottom: `1px solid ${typeColor}40`,
                    p: { xs: 1.5, sm: 1.75, md: 1.875, lg: 2, xl: 2.25 },
                    '@media (min-width: 2048px)': { p: 2.4 },
                    '@media (min-width: 3840px)': { p: 2.8 },
                    '@media (min-width: 5120px)': { p: 3.2 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 1.6, xl: 1.75 }, flex: 1, minWidth: 0 }}>
                      <Checkbox
                        checked={selectedIds.has(location.id)}
                        onChange={() => handleToggleSelect(location.id)}
                        inputProps={{ 'aria-label': `Velg lokasjon ${location.name}` }}
                        sx={{
                          p: 0.25,
                          color: 'rgba(255,255,255,0.87)',
                          '&.Mui-checked': { color: '#a855f7' },
                        }}
                      />
                      <Box
                        sx={{
                          width: { xs: 40, sm: 44, md: 46, lg: 48, xl: 52 },
                          height: { xs: 40, sm: 44, md: 46, lg: 48, xl: 52 },
                          borderRadius: 1.75,
                          bgcolor: `${typeColor}30`,
                          border: `1px solid ${typeColor}55`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 4px 10px ${typeColor}25`,
                          '@media (min-width: 2048px)': {
                            width: 58,
                            height: 58,
                          },
                          '@media (min-width: 3840px)': {
                            width: 68,
                            height: 68,
                          },
                          '@media (min-width: 5120px)': {
                            width: 76,
                            height: 76,
                          },
                        }}
                      >
                        <LocationIcon
                          sx={{
                            color: typeColor,
                            fontSize: { xs: 22, sm: 24, md: 25, lg: 26, xl: 28 },
                            '@media (min-width: 2048px)': { fontSize: 30 },
                            '@media (min-width: 3840px)': { fontSize: 34 },
                            '@media (min-width: 5120px)': { fontSize: 38 },
                          }}
                        />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="h6"
                          component="h3"
                          id={`location-name-${location.id}`}
                          sx={{
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: { xs: '0.95rem', sm: '1rem', md: '1.05rem', lg: '1.1rem', xl: '1.2rem' },
                            lineHeight: 1.25,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            '@media (min-width: 2048px)': { fontSize: '1.3rem' },
                            '@media (min-width: 3840px)': { fontSize: '1.45rem' },
                            '@media (min-width: 5120px)': { fontSize: '1.6rem' },
                          }}
                        >
                          {location.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 0.625, md: 0.75, lg: 0.875, xl: 1 }, mt: { xs: 0.5, sm: 0.625, md: 0.75, lg: 0.875, xl: 1 }, flexWrap: 'wrap' }}>
                          <Chip
                            label={getTypeLabel(location.type)}
                            size="small"
                            sx={{
                              bgcolor: `${typeColor}40`,
                              color: typeColor,
                              fontWeight: 700,
                              fontSize: { xs: '0.64rem', sm: '0.68rem', md: '0.7rem', lg: '0.74rem', xl: '0.8rem' },
                              height: { xs: 20, sm: 22, md: 23, lg: 24, xl: 26 },
                              border: `1px solid ${typeColor}60`,
                            }}
                          />
                          {Array.isArray(location.facilities) && location.facilities.length > 0 && (
                            <Box sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center' }}>
                              {location.facilities
                                .map((fac) => ({ key: fac, icon: getFacilityIcon(fac), label: getFacilityLabel(fac) }))
                                .filter((entry) => entry.icon !== null)
                                .slice(0, 4)
                                .map((entry) => (
                                  <Tooltip key={entry.key} title={entry.label} arrow>
                                    <Box
                                      sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 26,
                                        height: 22,
                                        borderRadius: 1,
                                        bgcolor: 'rgba(147,51,234,0.18)',
                                        color: '#c4b5fd',
                                        border: '1px solid rgba(147,51,234,0.32)',
                                      }}
                                    >
                                      {entry.icon}
                                    </Box>
                                  </Tooltip>
                                ))}
                              {location.facilities.filter((fac) => getFacilityIcon(fac) !== null).length > 4 && (
                                <Tooltip title={`+${location.facilities.filter((fac) => getFacilityIcon(fac) !== null).length - 4} fasiliteter til`} arrow>
                                  <Box
                                    sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 26,
                                      height: 22,
                                      borderRadius: 1,
                                      bgcolor: 'rgba(255,255,255,0.08)',
                                      color: 'rgba(255,255,255,0.65)',
                                      border: '1px solid rgba(255,255,255,0.15)',
                                    }}
                                  >
                                    <MoreFacilityIcon sx={{ fontSize: 14 }} />
                                  </Box>
                                </Tooltip>
                              )}
                            </Box>
                          )}
                          {location.capacity && (
                            <Chip
                              icon={<GroupIcon sx={{ fontSize: { xs: 12, sm: 14, md: 13, lg: 15, xl: 18 }, color: 'rgba(255,255,255,0.7) !important' }} />}
                              label={location.capacity}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.12)',
                                color: 'rgba(255,255,255,0.84)',
                                fontSize: { xs: '0.64rem', sm: '0.68rem', md: '0.7rem', lg: '0.74rem', xl: '0.8rem' },
                                height: { xs: 20, sm: 22, md: 23, lg: 24, xl: 26 },
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {location.address?.trim() && (
                        <Tooltip title="Verifiser adresse mot Kartverket" arrow>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              setVerifyingLocation(location);
                            }}
                            aria-label={`Verifiser ${location.name} mot Kartverket`}
                            sx={{
                              color: 'rgba(168,85,247,0.7)',
                              bgcolor: 'transparent',
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              borderRadius: 1.75,
                              '&:hover': {
                                bgcolor: 'rgba(168,85,247,0.12)',
                                color: '#c4b5fd',
                              },
                              ...focusVisibleStyles,
                            }}
                          >
                            <CompareArrowsIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 } }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <IconButton
                        onClick={() => toggleFavorite(location.id)}
                        aria-label={favorites.has(location.id) ? 'Fjern favoritt' : 'Legg til favoritt'}
                        sx={{
                          color: favorites.has(location.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                          bgcolor: favorites.has(location.id) ? 'rgba(251,191,36,0.12)' : 'transparent',
                          minWidth: TOUCH_TARGET_SIZE,
                          minHeight: TOUCH_TARGET_SIZE,
                          borderRadius: 1.75,
                          '&:hover': {
                            bgcolor: favorites.has(location.id) ? 'rgba(251,191,36,0.22)' : 'rgba(255,255,255,0.08)',
                          },
                          ...focusVisibleStyles,
                        }}
                      >
                        {favorites.has(location.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />}
                      </IconButton>
                    </Stack>
                  </Box>
                </Box>

                <CardContent
                  sx={{
                    p: { xs: 1.5, sm: 1.75, md: 1.875, lg: 2, xl: 2.25 },
                    '@media (min-width: 2048px)': { p: 2.4 },
                    '@media (min-width: 3840px)': { p: 2.8 },
                    '@media (min-width: 5120px)': { p: 3.2 },
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: { xs: 0.75, sm: 0.875, md: 1, lg: 1.125, xl: 1.25 },
                  }}
                >
                  {/* Address Info Card */}
                  {location.address && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                        p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                        mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                        borderRadius: 2,
                        bgcolor: 'rgba(168,85,247,0.1)',
                        border: '1px solid rgba(168,85,247,0.25)',
                      }}
                    >
                      {/* Map-thumbnail erstatter den abstrakte LocationIcon-boksen
                          når koordinater finnes — bruker ser HVOR, ikke bare et symbol */}
                      {location.coordinates?.lat && location.coordinates?.lng ? (
                        <LocationMapThumbnail
                          coordinates={location.coordinates}
                          width={58}
                          height={58}
                          label={`Kartvisning av ${location.name}`}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: { xs: 40, sm: 44, md: 42, lg: 50, xl: 58 },
                            height: { xs: 40, sm: 44, md: 42, lg: 50, xl: 58 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(168,85,247,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <LocationIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 }, color: '#c4b5fd' }} />
                        </Box>
                      )}
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
                          Adresse
                        </Typography>
                        <Typography
                          sx={{
                            color: '#fff',
                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.875rem', lg: '0.95rem', xl: '1.05rem' },
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {location.address}
                        </Typography>
                      </Box>
                      <Tooltip title={copiedId === location.id ? 'Kopiert!' : 'Kopier'}>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyAddress(location.address ?? '', location.id)}
                          sx={{ color: copiedId === location.id ? '#a855f7' : 'rgba(255,255,255,0.4)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                        >
                          {copiedId === location.id ? <CheckIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CopyIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}

                  {/* Validated Address Badge - clickable to open in maps */}
                  {location.coordinates && (
                    <Box
                      component="a"
                      href={`https://www.google.com/maps?q=${location.coordinates.lat},${location.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        mb: 1.5,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(139,92,246,0.1)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(139,92,246,0.2)',
                          borderColor: 'rgba(139,92,246,0.5)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 28, sm: 32, md: 30, lg: 36, xl: 42 },
                          height: { xs: 28, sm: 32, md: 30, lg: 36, xl: 42 },
                          borderRadius: 1,
                          bgcolor: 'rgba(139,92,246,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <LocationIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 18, xl: 20 }, color: '#a78bfa' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ 
                          color: '#a78bfa', 
                          fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, 
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {location.address || 'Adresse validert'}
                        </Typography>
                        <Typography sx={{ 
                          color: 'rgba(167,139,250,0.6)', 
                          fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' },
                        }}>
                          Klikk for å åpne i kart
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Facilities */}
                  {location.facilities && location.facilities.length > 0 && (
                    <Box sx={{ mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                      <Typography
                        sx={{
                          color: 'rgba(255,255,255,0.87)',
                          fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        }}
                      >
                        Fasiliteter
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        {location.facilities.slice(0, expandedCards.has(location.id) ? undefined : 4).map((facility) => (
                          <Chip
                            key={facility}
                            label={getFacilityLabel(facility)}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.08)',
                              color: 'rgba(255,255,255,0.8)',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                              border: '1px solid rgba(255,255,255,0.15)',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                            }}
                          />
                        ))}
                        {location.facilities.length > 4 && !expandedCards.has(location.id) && (
                          <Chip
                            label={`+${location.facilities.length - 4}`}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(168,85,247,0.2)',
                              color: '#c4b5fd',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                              fontWeight: 600,
                              border: '1px solid rgba(168,85,247,0.4)',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Assigned scenes */}
                  {normalizeSceneIds(location.assignedScenes).length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                        p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                        borderRadius: 1.5,
                        bgcolor: 'rgba(168,85,247,0.1)',
                        border: '1px solid rgba(168,85,247,0.3)',
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 28, sm: 32, md: 30, lg: 36, xl: 42 },
                          height: { xs: 28, sm: 32, md: 30, lg: 36, xl: 42 },
                          borderRadius: 1,
                          bgcolor: 'rgba(168,85,247,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AssessmentIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 18, xl: 20 }, color: '#c4b5fd' }} />
                      </Box>
                      <Typography sx={{ color: '#c4b5fd', fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, fontWeight: 600 }}>
                        {normalizeSceneIds(location.assignedScenes).length} scene{normalizeSceneIds(location.assignedScenes).length !== 1 ? 'r' : ''} tildelt
                      </Typography>
                    </Box>
                  )}

                  {/* Expandable section */}
                  <Collapse in={expandedCards.has(location.id)}>
                    <Box sx={{ mt: { xs: 0.75, sm: 1, md: 1.125, lg: 1.25, xl: 1.5 }, pt: { xs: 1.5, sm: 1.75, md: 1.875, lg: 2, xl: 2.25 }, borderTop: '1px solid rgba(168,85,247,0.22)' }}>
                      {location.notes && (
                        <Box
                          sx={{
                            p: { xs: 1.25, sm: 1.5, md: 1.75, lg: 1.875, xl: 2 },
                            mb: { xs: 1.25, sm: 1.5, md: 1.75, lg: 1.875, xl: 2 },
                            borderRadius: 1.75,
                            bgcolor: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}
                        >
                          <Typography
                            sx={{
                              color: 'rgba(255,255,255,0.87)',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                            }}
                          >
                            Notater
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.875rem', lg: '0.95rem', xl: '1.05rem' } }}>
                            {location.notes}
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: { xs: '0.7rem', sm: '0.75rem' }, mt: 0.6 }}>
                            Skrevet av:{' '}
                            {(() => {
                              const rawAuthor =
                                location.notesAuthorName
                                ?? location.notesAuthor
                                ?? location.notesBy;
                              return typeof rawAuthor === 'string' && rawAuthor.trim().length > 0
                                ? rawAuthor.trim()
                                : 'Ikke registrert';
                            })()}
                            {(() => {
                              const rawUpdatedAt =
                                location.notesUpdatedAt
                                ?? location.notesLastEditedAt
                                ?? location.notesTimestamp;
                              return typeof rawUpdatedAt === 'string' && rawUpdatedAt.trim().length > 0
                                ? ` • ${formatDateTimeShort(rawUpdatedAt)}`
                                : '';
                            })()}
                          </Typography>
                        </Box>
                      )}
                      {location.contactInfo && (location.contactInfo.name || location.contactInfo.phone || location.contactInfo.email) && (
                        <Stack spacing={{ xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }}>
                          {location.contactInfo.name && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                                p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                                borderRadius: 2,
                                bgcolor: 'rgba(77,208,225,0.1)',
                                border: '1px solid rgba(77,208,225,0.25)',
                              }}
                            >
                              <Box
                                sx={{
                                  width: { xs: 36, sm: 40, md: 38, lg: 44, xl: 52 },
                                  height: { xs: 36, sm: 40, md: 38, lg: 44, xl: 52 },
                                  borderRadius: 1.5,
                                  bgcolor: 'rgba(77,208,225,0.25)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <PersonIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 }, color: '#4dd0e1' }} />
                              </Box>
                              <Box>
                                <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' }, fontWeight: 600, textTransform: 'uppercase' }}>
                                  Kontaktperson
                                </Typography>
                                <Typography sx={{ color: '#fff', fontSize: { xs: '0.9rem', sm: '0.95rem', md: '0.925rem', lg: '1rem', xl: '1.125rem' }, fontWeight: 600 }}>
                                  {location.contactInfo.name}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                          {location.contactInfo.phone && (
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
                                  width: 36,
                                  height: 36,
                                  borderRadius: 1.5,
                                  bgcolor: 'rgba(139,92,246,0.25)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <PhoneIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 }, color: '#a78bfa' }} />
                              </Box>
                              <Box>
                                <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' }, fontWeight: 600, textTransform: 'uppercase' }}>
                                  Telefon
                                </Typography>
                                <Typography
                                  component="a"
                                  href={`tel:${location.contactInfo.phone}`}
                                  sx={{ color: '#a78bfa', fontSize: { xs: '0.95rem', sm: '1rem', md: '0.975rem', lg: '1.05rem', xl: '1.125rem' }, fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                                >
                                  {location.contactInfo.phone}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </Collapse>

                  {/* Card Actions - Enhanced */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: { xs: 'stretch', sm: 'center' },
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 1.75, sm: 2, md: 2.1, lg: 2.25, xl: 2.5 },
                      pt: { xs: 2, sm: 2.25 },
                      mt: 'auto',
                      borderTop: '1px solid rgba(168,85,247,0.24)',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => toggleCardExpanded(location.id)}
                      endIcon={expandedCards.has(location.id) ? <CollapseIcon /> : <ExpandIcon />}
                      aria-expanded={expandedCards.has(location.id)}
                      aria-label={expandedCards.has(location.id) ? 'Skjul info' : 'Vis info'}
                      sx={{
                        bgcolor: expandedCards.has(location.id) ? '#6d28d9 !important' : '#7c3aed !important',
                        color: '#fff !important',
                        fontSize: { xs: '0.8rem', sm: '0.84rem', md: '0.88rem', lg: '0.92rem', xl: '0.98rem' },
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        minHeight: TOUCH_TARGET_SIZE,
                        width: { xs: '100%', sm: 'auto' },
                        px: { xs: 2.1, sm: 2.4, md: 2.6, lg: 2.8, xl: 3.1 },
                        py: { xs: 0.7, sm: 0.75, md: 0.8, lg: 0.85, xl: 0.9 },
                        border: expandedCards.has(location.id)
                          ? '1px solid rgba(216,180,254,0.45)'
                          : '1px solid rgba(192,132,252,0.32)',
                        borderRadius: 2,
                        textTransform: 'none',
                        boxShadow: expandedCards.has(location.id) 
                          ? '0 2px 8px rgba(168,85,247,0.22)' 
                          : '0 1px 4px rgba(168,85,247,0.12)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: expandedCards.has(location.id) ? '#5b21b6 !important' : '#6d28d9 !important',
                          borderColor: 'rgba(216,180,254,0.5)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 4px 10px rgba(168,85,247,0.3)',
                        },
                        '&:active': {
                          transform: 'translateY(0px)',
                        },
                        '& .MuiButton-endIcon': {
                          marginLeft: 0.5,
                          transition: 'transform 0.25s ease',
                          transform: expandedCards.has(location.id) ? 'rotate(180deg)' : 'rotate(0deg)',
                        },
                        ...focusVisibleStyles,
                      }}
                    >
                      {expandedCards.has(location.id) ? 'Skjul detaljer' : 'Vis detaljer'}
                    </Button>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, auto))' },
                        gap: { xs: 1.1, sm: 1.2, md: 1.3, lg: 1.4, xl: 1.5 },
                        width: { xs: '100%', sm: 'auto' },
                        ml: { xs: 0, sm: 1.75, md: 2, lg: 2.2, xl: 2.4 },
                        '@media (min-width: 2048px) and (max-width: 3839px)': {
                          gap: 1.2,
                          ml: 1.9,
                        },
                      }}
                    >
                      <Tooltip title="Analyser lokasjon" arrow>
                        <IconButton
                          onClick={() => handleOpenAnalysisDialog(location)}
                          aria-label={`Analyser ${location.name}`}
                          sx={{
                            minWidth: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            minHeight: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            p: { xs: 1, sm: 1.05, md: 1.1, lg: 1.15, xl: 1.2 },
                            color: '#66dbff',
                            bgcolor: 'rgba(0,212,255,0.11)',
                            border: '1px solid rgba(0,212,255,0.28)',
                            borderRadius: 1.75,
                            '@media (min-width: 2048px) and (max-width: 3839px)': {
                              minWidth: 50,
                              minHeight: 50,
                              p: 1.1,
                            },
                            transition: 'all 0.2s ease',
                            '&:hover': { 
                              bgcolor: 'rgba(0,212,255,0.2)',
                              borderColor: 'rgba(0,212,255,0.45)',
                              transform: 'translateY(-1px)',
                            },
                            '&:active': {
                              transform: 'translateY(0px)',
                            },
                            ...focusVisibleStyles,
                          }}
                        >
                          <AnalyticsIcon sx={{ fontSize: { xs: 20, sm: 21, md: 22, lg: 23, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser" arrow>
                        <IconButton
                          onClick={() => handleDuplicate(location)}
                          aria-label={`Dupliser ${location.name}`}
                          sx={{
                            minWidth: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            minHeight: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            p: { xs: 1, sm: 1.05, md: 1.1, lg: 1.15, xl: 1.2 },
                            color: 'rgba(255,255,255,0.87)',
                            bgcolor: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 1.75,
                            '@media (min-width: 2048px) and (max-width: 3839px)': {
                              minWidth: 50,
                              minHeight: 50,
                              p: 1.1,
                            },
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', transform: 'translateY(-1px)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <DuplicateIcon sx={{ fontSize: { xs: 20, sm: 21, md: 22, lg: 23, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger" arrow>
                        <IconButton
                          onClick={() => handleOpenDialog(location)}
                          aria-label={`Rediger ${location.name}`}
                          sx={{
                            minWidth: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            minHeight: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            p: { xs: 1, sm: 1.05, md: 1.1, lg: 1.15, xl: 1.2 },
                            color: '#c4b5fd',
                            bgcolor: 'rgba(168,85,247,0.12)',
                            border: '1px solid rgba(168,85,247,0.24)',
                            borderRadius: 1.75,
                            '@media (min-width: 2048px) and (max-width: 3839px)': {
                              minWidth: 50,
                              minHeight: 50,
                              p: 1.1,
                            },
                            '&:hover': { bgcolor: 'rgba(168,85,247,0.2)', transform: 'translateY(-1px)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 20, sm: 21, md: 22, lg: 23, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett" arrow>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(location.id)}
                          aria-label={`Slett ${location.name}`}
                          sx={{
                            minWidth: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            minHeight: { xs: 46, sm: 48, md: 50, lg: 52, xl: 54 },
                            p: { xs: 1, sm: 1.05, md: 1.1, lg: 1.15, xl: 1.2 },
                            color: '#ff4444',
                            bgcolor: 'rgba(255,68,68,0.09)',
                            border: '1px solid rgba(255,68,68,0.2)',
                            borderRadius: 1.75,
                            '@media (min-width: 2048px) and (max-width: 3839px)': {
                              minWidth: 50,
                              minHeight: 50,
                              p: 1.1,
                            },
                            '&:hover': { bgcolor: 'rgba(255,68,68,0.15)', transform: 'translateY(-1px)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: { xs: 20, sm: 21, md: 22, lg: 23, xl: 24 } }} />
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
        </Box>
      )}

      {/* Location Analysis Dialog */}
      <LocationAnalysisDialog
        open={analysisDialogOpen}
        location={selectedLocationForAnalysis}
        onClose={() => {
          setAnalysisDialogOpen(false);
          setSelectedLocationForAnalysis(null);
        }}
        onAnalysisComplete={handleAnalysisComplete}
      />

      <LocationManagementGuide
        open={locationGuideOpen}
        onClose={() => setLocationGuideOpen(false)}
      />

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message={`"\${deletedLocation?.name}" slettet`}
        action={
          <Button color="primary" size="small" onClick={handleUndoDelete} sx={{ color: '#a855f7' }}>
            Angre
          </Button>
        }
        sx={{
          '& .MuiSnackbarContent-root': {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      />

      {/* Edit/Create Dialog - Responsive */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        container={() => document.body}
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescId}
        TransitionComponent={Grow}
        TransitionProps={{
          timeout: { enter: 225, exit: 150 },
          enter: true,
          exit: true,
        }}
        slotProps={{
          paper: {
            sx: {
              color: '#fff',
              background:
                'radial-gradient(120% 140% at 0% 0%, rgba(34,211,238,0.14) 0%, rgba(17,24,39,0) 48%), linear-gradient(165deg, rgba(17,12,36,0.98) 0%, rgba(10,8,23,0.98) 100%)',
              maxHeight: { xs: '100%', sm: '90vh' },
              maxWidth: { xs: '95vw', sm: '85vw', md: '80vw', lg: '75vw', xl: '70vw' },
              m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 4 },
              borderRadius: { xs: 0, sm: 3 },
              border: '1px solid rgba(168,85,247,0.45)',
              boxShadow:
                '0 28px 90px rgba(0,0,0,0.62), 0 0 0 1px rgba(34,211,238,0.14) inset, 0 0 32px rgba(168,85,247,0.24)',
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
              zIndex: 100000,
              overflow: 'hidden',
            },
          },
        }}
        sx={{
          zIndex: 100000,
          '& .MuiBackdrop-root': {
            zIndex: 99998,
            bgcolor: 'rgba(3,2,10,0.82)',
            backdropFilter: 'blur(5px)',
            willChange: 'opacity',
          },
        }}
      >
        <DialogTitle
          id={dialogTitleId}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
            gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
            borderBottom: '1px solid rgba(168,85,247,0.34)',
            background:
              'linear-gradient(120deg, rgba(139,92,246,0.28) 0%, rgba(14,20,42,0.95) 55%, rgba(34,211,238,0.2) 100%)',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: { xs: 38, sm: 42, md: 40, lg: 44, xl: 50 },
                height: { xs: 38, sm: 42, md: 40, lg: 44, xl: 50 },
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.92), rgba(124,58,237,0.88))',
                border: '1px solid rgba(216,180,254,0.42)',
                boxShadow: '0 10px 22px rgba(124,58,237,0.36)',
              }}
            >
              <LocationIcon sx={{ color: '#ffffff', fontSize: { xs: 20, sm: 22, md: 21, lg: 23, xl: 26 } }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.1875rem', lg: '1.375rem', xl: '1.75rem' }, fontWeight: 700, lineHeight: 1.15 }}>
                {editingLocation ? 'Rediger lokasjon' : 'Ny lokasjon'}
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: { xs: '0.76rem', sm: '0.84rem', md: '0.8rem', lg: '0.88rem', xl: '0.95rem' }, mt: 0.35 }}>
                Role Room lokasjonsregister
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={handleCloseDialog}
            aria-label="Lukk dialog"
            sx={{
              color: 'rgba(241,245,249,0.95)',
              mr: -0.5,
              minWidth: TOUCH_TARGET_SIZE,
              minHeight: TOUCH_TARGET_SIZE,
              border: '1px solid rgba(148,163,184,0.35)',
              bgcolor: 'rgba(15,23,42,0.55)',
              '&:hover': { bgcolor: 'rgba(30,41,59,0.85)', borderColor: 'rgba(168,85,247,0.55)' },
            }}
          >
            <CloseIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            pt: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 },
            px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
            pb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.38) 0%, rgba(8,10,24,0.22) 100%)',
          }}
        >
          <Typography
            id={dialogDescId}
            variant="body2"
            sx={{
              color: 'rgba(241,245,249,0.9)',
              mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              p: { xs: 1.25, sm: 1.5, md: 1.4, lg: 1.5, xl: 1.75 },
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.24)',
              background: 'linear-gradient(135deg, rgba(30,41,59,0.62) 0%, rgba(15,23,42,0.36) 100%)',
            }}
          >
            Fyll ut informasjon om lokasjonen. Felter merket med * er påkrevd.
          </Typography>
          <Stack spacing={{ xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }}>
            <TextField
              label="Navn *"
              fullWidth
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonNameIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#a855f7' },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#a855f7' },
              }}
            />

            <Box>
              <Autocomplete
                freeSolo
                fullWidth
                options={(() => {
                  // Når brukeren ikke har skrevet noe: vis recent addresses
                  // (raskere flyt for innholdsprodusenter med flere prosjekter
                  // på samme lokasjoner). Når brukeren skriver: vis Kartverket-
                  // forslag som vanlig. Krever at recent-objektene har samme
                  // shape som addressSuggestions for renderOption-konsistens.
                  if (addressQuery.trim().length < 2 && recentAddresses.length > 0) {
                    return recentAddresses.map((r) => ({
                      address: r.address,
                      municipality: r.municipality,
                      county: r.county,
                      postalCode: r.postalCode,
                      coordinates: r.coordinates,
                      _recent: true as const,
                    }));
                  }
                  return addressSuggestions;
                })()}
                loading={addressSuggestionsLoading}
                filterOptions={(x) => x}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.address}
                groupBy={(option) => typeof option !== 'string' && (option as { _recent?: boolean })._recent ? 'Nylig brukt' : 'Forslag fra Kartverket'}
                value={formData.address || ''}
                noOptionsText={
                  addressQuery.trim().length < 2
                    ? 'Begynn å skrive minst 2 tegn …'
                    : addressSuggestionsLoading
                      ? 'Henter forslag fra Kartverket …'
                      : 'Finner ikke adressen i Kartverket — fortsett med fri tekst'
                }
                loadingText="Henter forslag fra Kartverket …"
                onInputChange={(_event, value) => {
                  // Når brukeren editerer adresse-feltet manuelt: bli kvitt
                  // tidligere koordinater siden de ikke lenger nødvendigvis
                  // peker på riktig sted. Trygt — coordinates settes om
                  // igjen ved nytt valg fra dropdown.
                  setFormData((prev) => {
                    const sameAddress = prev.address === value;
                    if (sameAddress) {
                      return { ...prev, address: value };
                    }
                    const { coordinates: _drop, ...rest } = prev;
                    void _drop;
                    return { ...rest, address: value };
                  });
                  setAddressQuery(value);
                }}
                onChange={(_event, value) => {
                  // Brukeren valgte et autocomplete-forslag — auto-fyll
                  // koordinater + administrative data SILENT (uten å vise lat/lng).
                  // Smart auto-fill av navn: hvis Navn-feltet er tomt, prefill
                  // med adressetekst slik at brukeren ikke trenger å skrive den
                  // to ganger. Bruker kan overstyre om de vil ha et annet navn
                  // ("TV2-studio" istedenfor "Karl Johans gate 5").
                  if (value && typeof value !== 'string') {
                    setFormData((prev) => ({
                      ...prev,
                      address: value.address,
                      coordinates: value.coordinates,
                      // Persist administrative felt — brukes til regional
                      // filtrering (Vestlandet/Østlandet/etc.) uten å eksponere
                      // dem som egne input-felt for brukeren.
                      municipality: value.municipality || undefined,
                      county: value.county || undefined,
                      postalCode: value.postalCode || undefined,
                      name: prev.name?.trim() ? prev.name : value.address,
                    }));
                    // Lagre i recent-list for fremtidige raskere oppslag
                    rememberRecentAddress({
                      address: value.address,
                      municipality: value.municipality || '',
                      county: value.county || '',
                      postalCode: value.postalCode || '',
                      coordinates: value.coordinates,
                    });
                  } else if (typeof value === 'string') {
                    setFormData((prev) => ({ ...prev, address: value }));
                  }
                }}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={`${option.address}-${option.postalCode}`}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <Typography sx={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500 }}>
                        {option.address}
                      </Typography>
                      {option.municipality && (
                        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>
                          {option.postalCode} {option.municipality}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Adresse"
                    placeholder="Begynn å skrive adresse — vi henter forslag fra Kartverket"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <AddressIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <>
                          {addressSuggestionsLoading && (
                            <CircularProgress size={16} sx={{ color: '#a855f7', mr: 1 }} />
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                    sx={{
                      mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                        '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                        '& input': {
                          py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: 'rgba(255,255,255,0.87)',
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      },
                    }}
                  />
                )}
                componentsProps={{
                  paper: {
                    sx: {
                      bgcolor: 'rgba(15,23,42,0.98)',
                      border: '1px solid rgba(168,85,247,0.3)',
                      backdropFilter: 'blur(8px)',
                    },
                  },
                }}
              />
              <Button
                variant="outlined"
                onClick={handleValidateAddress}
                disabled={validatingAddress || !formData.address?.trim()}
                size="small"
                sx={{
                  color: '#a855f7',
                  borderColor: 'rgba(168,85,247,0.5)',
                  minHeight: TOUCH_TARGET_SIZE,
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  '&:hover': { borderColor: '#a855f7', bgcolor: 'rgba(168,85,247,0.1)' },
                }}
              >
                {validatingAddress ? 'Validerer...' : 'Valider adresse'}
              </Button>
              {formData.coordinates && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                    px: 1,
                    py: 0.4,
                    borderRadius: 999,
                    bgcolor: 'rgba(16,185,129,0.14)',
                    border: '1px solid rgba(16,185,129,0.36)',
                    color: '#6ee7b7',
                  }}
                >
                  <CheckIcon sx={{ fontSize: 14 }} />
                  <Typography
                    component="span"
                    sx={{
                      fontSize: { xs: '0.7rem', sm: '0.74rem', md: '0.72rem', lg: '0.78rem', xl: '0.85rem' },
                      fontWeight: 600,
                      letterSpacing: 0.2,
                    }}
                  >
                    Kart-verifisert
                  </Typography>
                </Box>
              )}
            </Box>

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Type</InputLabel>
              <Select
                value={formData.type || 'indoor'}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Location['type'] })}
                label="Type"
                MenuProps={{
                  sx: { zIndex: 100001 },
                  slotProps: {
                    paper: {
                      sx: {
                        bgcolor: '#1c2128',
                        color: '#fff',
                        maxHeight: 300,
                        '& .MuiMenuItem-root': {
                          '&:hover': { bgcolor: 'rgba(168,85,247,0.1)' },
                          '&.Mui-selected': { bgcolor: 'rgba(168,85,247,0.2)' },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '& .MuiSelect-select': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                }}
              >
                {locationTypes.map((type) => (
                  <MenuItem key={type} value={type} sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    {getTypeLabel(type)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Kapasitet"
              fullWidth
              type="number"
              value={formData.capacity || ''}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || undefined })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CapacityIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
              }}
            />

            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                Fasiliteter:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                {commonFacilities.map((facility) => (
                  <FormControlLabel
                    key={facility}
                    control={
                      <Checkbox
                        checked={(formData.facilities || []).includes(facility)}
                        onChange={() => handleFacilityToggle(facility)}
                        sx={{ color: '#a855f7', '&.Mui-checked': { color: '#a855f7' } }}
                      />
                    }
                    label={getFacilityLabel(facility)}
                    sx={{ 
                      color: 'rgba(255,255,255,0.87)', 
                      minHeight: TOUCH_TARGET_SIZE,
                      '& .MuiFormControlLabel-label': {
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>

            <TextField
              label="Kontaktperson navn"
              fullWidth
              value={formData.contactInfo?.name || ''}
              onChange={(e) => setFormData({ ...formData, contactInfo: { ...formData.contactInfo, name: e.target.value } })}
              sx={{
                '& .MuiOutlinedInput-root': { 
                  color: '#fff', 
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
              }}
            />

            <TextField
              label="Kontaktperson telefon"
              fullWidth
              value={formData.contactInfo?.phone || ''}
              onChange={(e) => setFormData({ ...formData, contactInfo: { ...formData.contactInfo, phone: e.target.value } })}
              sx={{
                '& .MuiOutlinedInput-root': { 
                  color: '#fff', 
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
              }}
            />

            <TextField
              label="Kontaktperson e-post"
              fullWidth
              type="email"
              value={formData.contactInfo?.email || ''}
              onChange={(e) => setFormData({ ...formData, contactInfo: { ...formData.contactInfo, email: e.target.value } })}
              sx={{
                '& .MuiOutlinedInput-root': { 
                  color: '#fff', 
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
              }}
            />

            <TextField
              label="Notater"
              fullWidth
              multiline
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': { 
                  color: '#fff',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '& textarea': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
              }}
            />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>
              Skrevet av:{' '}
              {(() => {
                const rawAuthor =
                  formData.notesAuthorName
                  ?? formData.notesAuthor
                  ?? formData.notesBy;
                return typeof rawAuthor === 'string' && rawAuthor.trim().length > 0
                  ? rawAuthor.trim()
                  : 'Ikke registrert';
              })()}
              {(() => {
                const rawUpdatedAt =
                  formData.notesUpdatedAt
                  ?? formData.notesLastEditedAt
                  ?? formData.notesTimestamp;
                return typeof rawUpdatedAt === 'string' && rawUpdatedAt.trim().length > 0
                  ? ` • ${formatDateTimeShort(rawUpdatedAt)}`
                  : '';
              })()}
            </Typography>
            <GlobalMentionHelper
              text={typeof formData.notes === 'string' ? formData.notes : ''}
              localCandidates={mentionCandidates}
              onApplySuggestion={(name) =>
                setFormData((prev) => ({
                  ...prev,
                  notes: applyMentionSuggestion(typeof prev.notes === 'string' ? prev.notes : '', name),
                }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(168,85,247,0.28)',
            p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
            position: { xs: 'sticky', sm: 'relative' },
            bottom: 0,
            bgcolor: 'rgba(8,10,24,0.82)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            fullWidth={isMobile}
            sx={{ 
              color: 'rgba(226,232,240,0.95)',
              border: '1px solid rgba(148,163,184,0.38)',
              bgcolor: 'rgba(15,23,42,0.55)',
              minHeight: TOUCH_TARGET_SIZE,
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              ...focusVisibleStyles,
              '&:hover': { bgcolor: 'rgba(30,41,59,0.88)', borderColor: 'rgba(168,85,247,0.48)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={<SaveIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#a855f7',
              color: '#fff',
              fontWeight: 700,
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              minHeight: TOUCH_TARGET_SIZE,
              ...focusVisibleStyles,
              border: '1px solid rgba(216,180,254,0.45)',
              boxShadow: '0 10px 24px rgba(124,58,237,0.45)',
              backgroundImage: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              '&:hover': { backgroundImage: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)' },
            }}
          >
            {editingLocation ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      <VerifyLocationDialog
        open={Boolean(verifyingLocation)}
        location={verifyingLocation}
        onClose={() => setVerifyingLocation(null)}
        onApply={async (locationId, updates) => {
          // Robust update: oppdater både server og lokal state. Hvis server-call
          // feiler, vises eksisterende showError-toast; lokal state oppdateres
          // ikke før serveren bekrefter.
          const existing = locations.find((l) => l.id === locationId);
          if (!existing) return;
          const merged: Location = { ...existing, ...updates };
          try {
            await castingService.saveLocation(projectId, merged);
            setLocations((prev) => prev.map((l) => (l.id === locationId ? merged : l)));
            showSuccess('Lokasjonen oppdatert med Kartverket-data', 3000);
          } catch (err) {
            showError(
              err instanceof Error ? err.message : 'Kunne ikke lagre Kartverket-oppdateringer',
              4000,
            );
          }
        }}
      />
    </Box>
  );
}
