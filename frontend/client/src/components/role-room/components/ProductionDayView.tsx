import { useState, useMemo, useEffect, useId, useCallback, type ReactNode } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Grid,
  Paper,
  Tooltip,
  Collapse,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Alert,
  Snackbar,
  useTheme,
  useMediaQuery,
  Grow,
  Divider,
  LinearProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  Movie as MovieIcon,
  AccessTime as TimeIcon,
  OpenInNew as OpenInNewIcon,
  Image as ImageIcon,
  WbSunny as SunIcon,
  Cloud as CloudIcon,
  Umbrella as UmbrellaIcon,
  AcUnit as SnowIcon,
  Thunderstorm as ThunderIcon,
  Air as WindIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewModule as GridViewIcon,
  ViewList as TableViewIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ContentCopy as DuplicateIcon,
  FileDownload as ExportIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  EditNote as NotesIcon,
  NotificationsActive as NotifyIcon,
  Warning as WarningIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  CheckCircle as CheckCircleIcon,
  Description as CallSheetIcon,
  CloudOff as OfflineIcon,
  CloudQueue as OnlineIcon,
  SwapHoriz as RescheduleIcon,
  Comment as CommentIcon,
  AssignmentTurnedIn as ReadyIcon,
  ErrorOutline as RiskIcon,
  Block as BlockedIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Autorenew as QueueIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import globalTagService from '../services/globalTagService';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { LocationsIcon as LocationIcon, CalendarCustomIcon as CalendarMonthIcon, StatsIcon } from './icons/CastingIcons';
import type { CrewMember, Location, ProductionDay, Prop } from '../models/casting';
import { productionPlanningService } from '../services/productionPlanningService';
import { castingService } from '../services/castingService';
import { externalDataService } from '@/services/ExternalDataService';
import { WeatherForecastCard } from './WeatherForecastCard';
import { TravelCostsCard } from './TravelCostsCard';
import { useToast } from './ToastStack';
import { RichTextEditor } from './RichTextEditor';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import calenderPng from './icons/Keep/roleroom_calender.png';
import { TOUCH_TARGET_SIZE } from '../constants/accessibility';

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #9c27b0',
    outlineOffset: 2,
  },
};

type SortField = 'date' | 'location' | 'status' | 'scenes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type StatusFilter = 'all' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
type ReadinessLevel = 'klar' | 'risiko' | 'blokkert';
type TeamFlowEntryType = 'comment' | 'decision';

interface TeamFlowEntry {
  id: string;
  author: string;
  createdAt: string;
  type: TeamFlowEntryType;
  text: string;
  mentions: string[];
}

interface ProductionDayProMeta {
  permitsReady?: boolean;
  transportReady?: boolean;
  dependencies?: string[];
  estimatedMinutes?: number;
  actualMinutes?: number;
  checkInAt?: string;
  checkOutAt?: string;
  lastFieldStatus?: ProductionDay['status'];
  riskAccepted?: boolean;
  teamFlow?: TeamFlowEntry[];
}

interface OfflineFieldQueueItem {
  id: string;
  dayId: string;
  action: 'check_in' | 'check_out' | 'status_update';
  payload: {
    status?: ProductionDay['status'];
    timestamp: string;
  };
  createdAt: string;
}

interface ReadinessResult {
  level: ReadinessLevel;
  score: number;
  reasons: string[];
}

interface DayConflictSummary {
  crew: string[];
  location: string[];
  props: string[];
  time: string[];
  total: number;
}

interface ScenePreviewState {
  id: string;
  name: string;
  thumbnail?: string;
}

type ProductionDayStatus = NonNullable<ProductionDay['status']>;
type ProductionDayChangeLogEntry = NonNullable<ProductionDay['changeLog']>[number];
type NormalizedProductionDay = ProductionDay & {
  date: string;
  locationId: string;
  scenes: string[];
  crew: string[];
  props: string[];
  callTime: string;
  wrapTime: string;
  notes: string;
  status: ProductionDayStatus;
  updatedAt: string;
  changeLog: ProductionDayChangeLogEntry[];
};

interface ProductionDayViewProps {
  projectId: string;
  onUpdate?: () => void;
  profession?: 'photographer' | 'videographer' | null;
}

export function ProductionDayView({ projectId, onUpdate, profession }: ProductionDayViewProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isIPadLandscape = useMediaQuery('(min-width: 1024px) and (max-width: 1366px) and (orientation: landscape)');
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;
  const showExtendedLabels = !isMobile && (isDesktop || isIPadLandscape || !isTablet);

  // Toast notifications
  const { showSuccess, showError, showInfo, showWarning } = useToast();

  // Unique IDs for WCAG
  const baseId = useId();
  const dialogTitleId = `${baseId}-dialog-title`;
  const dialogDescId = `${baseId}-dialog-desc`;

  // Core state
  const [productionDays, setProductionDays] = useState<NormalizedProductionDay[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [props, setProps] = useState<Prop[]>([]);

  const normalizeProductionDay = useCallback((day: ProductionDay): NormalizedProductionDay => ({
    ...day,
    date: day.date ?? '',
    locationId: day.locationId ?? '',
    scenes: Array.isArray(day.scenes) ? day.scenes : [],
    crew: Array.isArray(day.crew) ? day.crew : [],
    props: Array.isArray(day.props) ? day.props : [],
    callTime: day.callTime ?? '09:00',
    wrapTime: day.wrapTime ?? '17:00',
    notes: day.notes ?? '',
    status: day.status ?? 'planned',
    updatedAt: day.updatedAt ?? day.createdAt ?? new Date(0).toISOString(),
    changeLog: Array.isArray(day.changeLog) ? day.changeLog : [],
  }), []);
  
  // Load production days, locations, crew, and props when projectId changes
  useEffect(() => {
    const loadData = async () => {
      if (projectId) {
        try {
          const [days, locs, crewData, propsData] = await Promise.all([
            productionPlanningService.getProductionDays(projectId),
            castingService.getLocations(projectId),
            castingService.getCrew(projectId),
            castingService.getProps(projectId),
          ]);
          setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
          setLocations(Array.isArray(locs) ? locs : []);
          setCrew(Array.isArray(crewData) ? crewData : []);
          setProps(Array.isArray(propsData) ? propsData : []);
        } catch (error) {
          console.error('Error loading production data:', error);
          setProductionDays([]);
          setLocations([]);
          setCrew([]);
          setProps([]);
        }
      }
    };
    loadData();
  }, [projectId]);

  // Load day-specific data (scenes, crew, props, validation) for each production day
  useEffect(() => {
    const loadDayData = async () => {
      if (!projectId || productionDays.length === 0) {
        setDayDataCache({});
        return;
      }

      const newCache: Record<string, typeof dayDataCache[string]> = {};
      
      // Load data for all days in parallel
      await Promise.all(
        productionDays.map(async (day) => {
          try {
            const [scenes, dayCrew, dayProps, validation] = await Promise.all([
              productionPlanningService.getScenesForDay(projectId, day.id),
              productionPlanningService.getCrewForDay(projectId, day.id),
              productionPlanningService.getPropsForDay(projectId, day.id),
              productionPlanningService.validateProductionDay(projectId, day.id),
            ]);
            
            newCache[day.id] = {
              scenes: scenes || [],
              crew: dayCrew || [],
              props: dayProps || [],
              validation: validation || { valid: true, errors: [], warnings: [] },
            };
          } catch (error) {
            console.error(`Error loading data for day ${day.id}:`, error);
            newCache[day.id] = {
              scenes: [],
              crew: [],
              props: [],
              validation: { valid: true, errors: [], warnings: [] },
            };
          }
        })
      );
      
      setDayDataCache(newCache);
    };
    
    loadDayData();
  }, [projectId, productionDays]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<NormalizedProductionDay | null>(null);
  // Profession-specific default timing templates
  const getDefaultTiming = () => {
    if (profession === 'photographer') {
      // Photographer: Focus on lighting conditions, time-of-day
      return {
        callTime: '08:00', // Earlier for golden hour prep
        wrapTime: '18:00', // Later for golden hour shooting
      };
    } else if (profession === 'videographer') {
      // Videographer: Focus on scene sequences, continuity
      return {
        callTime: '09:00', // Standard production day
        wrapTime: '17:00', // Standard wrap time
      };
    }
    return {
      callTime: '09:00',
      wrapTime: '17:00',
    };
  };

  const [formData, setFormData] = useState<Partial<NormalizedProductionDay>>({
    date: new Date().toISOString().split('T')[0],
    ...getDefaultTiming(),
    locationId: '',
    scenes: [],
    crew: [],
    props: [],
    notes: '',
    status: 'planned',
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const filtersExpanded = !isMobile || showFilters;

  // Sort state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showStats, setShowStats] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Favorites state with settings cache
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  const FAVORITES_NAMESPACE = 'virtualStudio_productionDayFavorites';

  useEffect(() => {
    const loadFavorites = async () => {
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

  // Undo delete state
  const [deletedDay, setDeletedDay] = useState<NormalizedProductionDay | null>(null);
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  const [scenePreview, setScenePreview] = useState<ScenePreviewState | null>(null);

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Cached day data for async loading
  interface DayDataCache {
    scenes: Array<{ id: string; name: string; thumbnail?: string }>;
    crew: Array<{ id: string; name: string; role: string }>;
    props: Array<{ id: string; name: string; category: string }>;
    validation: { valid: boolean; errors: string[]; warnings: string[] };
  }
  const [dayDataCache, setDayDataCache] = useState<Record<string, DayDataCache>>({});

  // Pro workflow state (persisted per project)
  const [proViewEnabled, setProViewEnabled] = useState(true);
  const [proMetaByDay, setProMetaByDay] = useState<Record<string, ProductionDayProMeta>>({});
  const [proMetaLoaded, setProMetaLoaded] = useState(false);
  const [proSelectedDayId, setProSelectedDayId] = useState<string | null>(null);
  const [teamFlowDraftByDay, setTeamFlowDraftByDay] = useState<Record<string, string>>({});
  const [showBulkShiftDialog, setShowBulkShiftDialog] = useState(false);
  const [bulkShiftDays, setBulkShiftDays] = useState(1);
  const [draggingDayId, setDraggingDayId] = useState<string | null>(null);
  const [dragTargetDayId, setDragTargetDayId] = useState<string | null>(null);
  const [showDragPreviewDialog, setShowDragPreviewDialog] = useState(false);
  const [fieldModeEnabled, setFieldModeEnabled] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineFieldQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [globalTagRegistry, setGlobalTagRegistry] = useState<string[]>([]);
  const [globalTagRegistryLoaded, setGlobalTagRegistryLoaded] = useState(false);

  const PRO_META_NAMESPACE = 'virtualStudio_productionDayProMeta_v1';
  const PRO_FIELD_QUEUE_NAMESPACE = 'virtualStudio_productionDayFieldQueue_v1';

  // Inform team dialog state
  const [showInformTeamDialog, setShowInformTeamDialog] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<NormalizedProductionDay | null>(null);
  const [changedFields, setChangedFields] = useState<string[]>([]);

  // Render markdown-formatted notes as React elements
  const renderFormattedNotes = (notes?: string): ReactNode => {
    if (!notes) return null;

    const lines = notes.split('\n');

    return lines.map((line, lineIndex) => {
      // Check for divider line
      if (line.includes('―――――――――――')) {
        return (
          <Divider
            key={lineIndex}
            sx={{
              my: 1.5,
              borderColor: 'rgba(255,193,7,0.3)',
              borderWidth: 2,
            }}
          />
        );
      }

      // Check for heading (## )
      const isHeading = line.startsWith('## ');
      const headingContent = isHeading ? line.substring(3) : line;

      // Check for bullet list (• )
      const isBullet = line.startsWith('• ');
      const bulletContent = isBullet ? line.substring(2) : headingContent;

      // Check for numbered list (1. , 2. , etc.)
      const numberMatch = line.match(/^(\d+)\.\s/);
      const isNumbered = numberMatch !== null;
      const numberedContent = isNumbered ? line.substring(numberMatch[0].length) : bulletContent;

      // Check for checkbox (☐ or ☑)
      const isUncheckedBox = line.startsWith('☐ ');
      const isCheckedBox = line.startsWith('☑ ');
      const checkboxContent = (isUncheckedBox || isCheckedBox) ? line.substring(2) : numberedContent;

      // Parse inline formatting (bold and italic)
      const parseInlineFormatting = (text: string): ReactNode => {
        const parts: ReactNode[] = [];
        let remaining = text;
        let keyCounter = 0;

        while (remaining.length > 0) {
          // Look for **bold**
          const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
          // Look for _italic_
          const italicMatch = remaining.match(/_(.+?)_/);

          // Find which comes first
          const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
          const italicIndex = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;

          if (boldIndex === -1 && italicIndex === -1) {
            // No more formatting, add remaining text
            if (remaining) parts.push(remaining);
            break;
          }

          // Determine which formatting comes first
          const usesBold = boldIndex !== -1 && (italicIndex === -1 || boldIndex < italicIndex);

          if (usesBold && boldMatch) {
            // Add text before bold
            if (boldIndex > 0) {
              parts.push(remaining.substring(0, boldIndex));
            }
            // Add bold text
            parts.push(
              <Box
                component="span"
                key={`bold-${keyCounter++}`}
                sx={{ fontWeight: 700, color: '#ffc107' }}
              >
                {boldMatch[1]}
              </Box>
            );
            remaining = remaining.substring(boldIndex + boldMatch[0].length);
          } else if (italicMatch) {
            // Add text before italic
            if (italicIndex > 0) {
              parts.push(remaining.substring(0, italicIndex));
            }
            // Add italic text
            parts.push(
              <Box
                component="span"
                key={`italic-${keyCounter++}`}
                sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.85)' }}
              >
                {italicMatch[1]}
              </Box>
            );
            remaining = remaining.substring(italicIndex + italicMatch[0].length);
          }
        }

        return parts.length > 0 ? parts : text;
      };

      const content = parseInlineFormatting(checkboxContent);

      // Render based on line type
      if (isHeading) {
        return (
          <Typography
            key={lineIndex}
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.125rem', sm: '1.25rem' },
              color: '#ffc107',
              mt: lineIndex > 0 ? 2 : 0,
              mb: 1,
              borderBottom: '2px solid rgba(255,193,7,0.3)',
              pb: 0.5,
            }}
          >
            {content}
          </Typography>
        );
      }

      if (isBullet) {
        return (
          <Box key={lineIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.75 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#ffc107',
                mt: 1,
                flexShrink: 0,
              }}
            />
            <Typography sx={{ color: '#fff', lineHeight: 1.7 }}>{content}</Typography>
          </Box>
        );
      }

      if (isNumbered && numberMatch) {
        return (
          <Box key={lineIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.75 }}>
            <Box
              sx={{
                minWidth: 24,
                height: 24,
                borderRadius: 1,
                bgcolor: 'rgba(255,193,7,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.8125rem',
                color: '#ffc107',
                flexShrink: 0,
              }}
            >
              {numberMatch[1]}
            </Box>
            <Typography sx={{ color: '#fff', lineHeight: 1.7 }}>{content}</Typography>
          </Box>
        );
      }

      if (isUncheckedBox || isCheckedBox) {
        return (
          <Box key={lineIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.75 }}>
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: 1,
                border: '2px solid',
                borderColor: isCheckedBox ? '#4caf50' : 'rgba(255,255,255,0.4)',
                bgcolor: isCheckedBox ? 'rgba(76,175,80,0.2)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              {isCheckedBox && (
                <Typography sx={{ color: '#4caf50', fontWeight: 700, fontSize: '0.875rem' }}>✓</Typography>
              )}
            </Box>
            <Typography
              sx={{
                color: isCheckedBox ? 'rgba(255,255,255,0.5)' : '#fff',
                lineHeight: 1.7,
                textDecoration: isCheckedBox ? 'line-through' : 'none',
              }}
            >
              {content}
            </Typography>
          </Box>
        );
      }

      // Regular paragraph or empty line
      if (line.trim() === '') {
        return <Box key={lineIndex} sx={{ height: 12 }} />;
      }

      return (
        <Typography
          key={lineIndex}
          sx={{
            color: '#fff',
            lineHeight: 1.8,
            mb: 0.5,
          }}
        >
          {content}
        </Typography>
      );
    });
  };

  const availableScenes = castingService.getAvailableScenes(projectId);

  const openLocationInMaps = useCallback((locationId?: string) => {
    const location = locations.find((entry) => entry.id === locationId);
    if (!location) {
      showWarning('Fant ikke lokasjon for å åpne kart');
      return;
    }

    const coordinateUrl =
      location.coordinates?.lat !== undefined && location.coordinates?.lng !== undefined
        ? `https://www.google.com/maps?q=${location.coordinates.lat},${location.coordinates.lng}`
        : null;
    const address = typeof location.address === 'string' ? location.address.trim() : '';
    const addressUrl = address.length > 0
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null;
    const targetUrl = coordinateUrl ?? addressUrl;

    if (!targetUrl) {
      showInfo('Denne lokasjonen har ikke koordinater eller adresse ennå');
      return;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }, [locations, showInfo, showWarning]);

  // Save favorites to settings cache
  useEffect(() => {
    if (!favoritesLoaded) return;
    void settingsService.setSetting(FAVORITES_NAMESPACE, [...favorites], { projectId });
  }, [favorites, projectId, favoritesLoaded]);

  useEffect(() => {
    const loadProSettings = async () => {
      const [storedMeta, storedQueue] = await Promise.all([
        settingsService.getSetting<Record<string, ProductionDayProMeta>>(PRO_META_NAMESPACE, { projectId }),
        settingsService.getSetting<OfflineFieldQueueItem[]>(PRO_FIELD_QUEUE_NAMESPACE, { projectId }),
      ]);
      if (storedMeta) {
        setProMetaByDay(storedMeta);
      }
      if (Array.isArray(storedQueue)) {
        setOfflineQueue(storedQueue);
      }
      setProMetaLoaded(true);
    };
    void loadProSettings();
  }, [projectId]);

  useEffect(() => {
    if (!proMetaLoaded) return;
    void settingsService.setSetting(PRO_META_NAMESPACE, proMetaByDay, { projectId });
  }, [proMetaByDay, projectId, proMetaLoaded]);

  useEffect(() => {
    if (!proMetaLoaded) return;
    void settingsService.setSetting(PRO_FIELD_QUEUE_NAMESPACE, offlineQueue, { projectId });
  }, [offlineQueue, projectId, proMetaLoaded]);

  useEffect(() => {
    let active = true;
    const loadGlobalTags = async () => {
      const tags = await globalTagService.load();
      if (!active) return;
      setGlobalTagRegistry(tags);
      setGlobalTagRegistryLoaded(true);
    };
    void loadGlobalTags();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!globalTagRegistryLoaded) return;
    const seedTags = crew
      .map((member: any) => String(member?.name || '').trim())
      .filter((name) => name.length > 0);
    if (seedTags.length === 0) return;
    void globalTagService.add(seedTags).then((tags) => {
      setGlobalTagRegistry(tags);
    });
  }, [crew, globalTagRegistryLoaded]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const syncOfflineQueue = async () => {
      if (!isOnline || offlineQueue.length === 0) return;
      const queueCopy = [...offlineQueue];
      for (const queueItem of queueCopy) {
        const targetDay = productionDays.find((day) => day.id === queueItem.dayId);
        if (!targetDay) continue;
        const nextDay: ProductionDay = {
          ...targetDay,
          status: queueItem.payload.status || targetDay.status,
          updatedAt: new Date().toISOString(),
        };
        try {
          await productionPlanningService.saveProductionDay(projectId, nextDay);
          setOfflineQueue((prev) => prev.filter((item) => item.id !== queueItem.id));
        } catch (error) {
          console.error('Offline queue sync failed:', error);
        }
      }
      const days = await productionPlanningService.getProductionDays(projectId);
      setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
    };

    void syncOfflineQueue();

    const handleOnline = () => {
      void syncOfflineQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isOnline, offlineQueue, productionDays, projectId]);

  // Load weather forecasts for production days that don't have them
  useEffect(() => {
    const loadMissingWeatherForecasts = async () => {
      const daysNeedingWeather = productionDays.filter(day => {
        // Only load for days without weather forecast that have a location with coordinates
        if (day.weatherForecast) return false;
        const location = locations.find(l => l.id === day.locationId);
        return location?.coordinates?.lat && location?.coordinates?.lng;
      });

      if (daysNeedingWeather.length === 0) return;

      for (const day of daysNeedingWeather) {
        const location = locations.find(l => l.id === day.locationId);
        if (!location?.coordinates) continue;

        try {
          const forecast = await externalDataService.getWeatherForecast({
            lat: location.coordinates.lat,
            lon: location.coordinates.lng,
            days: 1,
          });

          if (forecast) {
            const updatedDay = { ...day, weatherForecast: forecast, updatedAt: new Date().toISOString() };
            await castingService.saveProductionDay(projectId, updatedDay);
          }
        } catch (error) {
          console.error(`Failed to load weather for day ${day.id}:`, error);
        }
      }

      // Reload production days to get updated weather
      const days = await productionPlanningService.getProductionDays(projectId);
      setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
    };

    loadMissingWeatherForecasts();
  }, [projectId, locations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (locations.length > 0) handleOpenDialog();
      }
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        handleExportCSV();
      }
      if (e.key === 'Escape' && dialogOpen) {
        handleCloseDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, locations.length]);

  // Helper functions
  const getLocationName = (locationId?: string): string => {
    if (!locationId) return 'Ingen lokasjon';
    const location = locations.find((entry) => entry.id === locationId);
    return location?.name ?? locationId;
  };

  const getStatusColor = (status?: ProductionDayStatus): string => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#00d4ff';
      case 'cancelled': return '#ff4444';
      default: return '#ffb800';
    }
  };

  const getStatusLabel = (status?: ProductionDayStatus): string => {
    switch (status) {
      case 'completed': return 'Fullført';
      case 'in_progress': return 'Pågår';
      case 'cancelled': return 'Kansellert';
      default: return 'Planlagt';
    }
  };

  const getDayUpdatedAt = (day: ProductionDay | NormalizedProductionDay): string =>
    day.updatedAt ?? day.createdAt ?? new Date(0).toISOString();

  const getDayChangeLog = (day: ProductionDay | NormalizedProductionDay): ProductionDayChangeLogEntry[] =>
    Array.isArray(day.changeLog) ? day.changeLog : [];

  // Filtered and sorted production days
  const filteredAndSortedDays = useMemo(() => {
    let result = [...productionDays];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (day) =>
          getLocationName(day.locationId).toLowerCase().includes(query) ||
          day.notes?.toLowerCase().includes(query) ||
          new Date(day.date).toLocaleDateString('nb-NO').includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((day) => day.status === statusFilter);
    }

    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'location':
          comparison = getLocationName(a.locationId).localeCompare(getLocationName(b.locationId), 'nb');
          break;
        case 'status':
          comparison = getStatusLabel(a.status).localeCompare(getStatusLabel(b.status), 'nb');
          break;
        case 'scenes':
          comparison = a.scenes.length - b.scenes.length;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [productionDays, searchQuery, statusFilter, sortField, sortDirection, favorites, locations]);

  useEffect(() => {
    if (!proSelectedDayId && filteredAndSortedDays.length > 0) {
      setProSelectedDayId(filteredAndSortedDays[0].id);
      return;
    }
    if (proSelectedDayId && !filteredAndSortedDays.some((day) => day.id === proSelectedDayId)) {
      setProSelectedDayId(filteredAndSortedDays[0]?.id ?? null);
    }
  }, [filteredAndSortedDays, proSelectedDayId]);

  // Group by month for grid view
  const groupedDays = useMemo(() => {
    const groups: Record<string, NormalizedProductionDay[]> = {};
    filteredAndSortedDays.forEach((day) => {
      const monthKey = new Date(day.date).toLocaleDateString('no-NO', {
        year: 'numeric',
        month: 'long',
      });
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(day);
    });
    return groups;
  }, [filteredAndSortedDays]);

  // Statistics
  const stats = useMemo(() => {
    const statusCount: Record<ProductionDayStatus, number> = {
      planned: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    productionDays.forEach((day) => {
      statusCount[day.status ?? 'planned'] += 1;
    });

    const totalScenes = productionDays.reduce((acc, day) => acc + day.scenes.length, 0);
    const totalCrew = productionDays.reduce((acc, day) => acc + day.crew.length, 0);

    return {
      totalDays: productionDays.length,
      statusCount,
      totalScenes,
      totalCrew,
      favorites: favorites.size,
    };
  }, [productionDays, favorites]);

  const mentionDirectory = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...crew.map((member: any) => String(member?.name || '').trim()).filter(Boolean),
            ...globalTagRegistry,
          ]
        )
      ).sort((a, b) => a.localeCompare(b, 'nb')),
    [crew, globalTagRegistry]
  );

  const parseClockMinutes = (clock?: string): number | null => {
    if (!clock || !clock.includes(':')) return null;
    const [h, m] = clock.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const plannedMinutesForDay = (day: ProductionDay | NormalizedProductionDay): number => {
    const start = parseClockMinutes(day.callTime);
    const endRaw = parseClockMinutes(day.wrapTime);
    if (start === null || endRaw === null) return 0;
    const end = endRaw < start ? endRaw + 24 * 60 : endRaw;
    return Math.max(0, end - start);
  };

  const rangesOverlap = (aStart: number | null, aEnd: number | null, bStart: number | null, bEnd: number | null): boolean => {
    if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
    const aEffectiveEnd = aEnd < aStart ? aEnd + 24 * 60 : aEnd;
    const bEffectiveEnd = bEnd < bStart ? bEnd + 24 * 60 : bEnd;
    return aStart < bEffectiveEnd && bStart < aEffectiveEnd;
  };

  const conflictMap = useMemo<Record<string, DayConflictSummary>>(() => {
    const map: Record<string, DayConflictSummary> = {};
    productionDays.forEach((day) => {
      map[day.id] = { crew: [], location: [], props: [], time: [], total: 0 };
    });

    for (let i = 0; i < productionDays.length; i += 1) {
      for (let j = i + 1; j < productionDays.length; j += 1) {
        const a = productionDays[i];
        const b = productionDays[j];
        if (a.date !== b.date) continue;

        const overlaps = rangesOverlap(
          parseClockMinutes(a.callTime),
          parseClockMinutes(a.wrapTime),
          parseClockMinutes(b.callTime),
          parseClockMinutes(b.wrapTime)
        );
        if (!overlaps) continue;

        const aCrew = new Set(Array.isArray(a.crew) ? a.crew : []);
        const bCrew = new Set(Array.isArray(b.crew) ? b.crew : []);
        const sharedCrew = [...aCrew].filter((crewId) => bCrew.has(crewId));

        const aProps = new Set(Array.isArray(a.props) ? a.props : []);
        const bProps = new Set(Array.isArray(b.props) ? b.props : []);
        const sharedProps = [...aProps].filter((propId) => bProps.has(propId));

        map[a.id].time.push(`Tidskollisjon med ${new Date(b.date).toLocaleDateString('nb-NO')} (${b.callTime}-${b.wrapTime})`);
        map[b.id].time.push(`Tidskollisjon med ${new Date(a.date).toLocaleDateString('nb-NO')} (${a.callTime}-${a.wrapTime})`);

        if (a.locationId && b.locationId && a.locationId === b.locationId) {
          map[a.id].location.push(`Lokasjonen brukes også av en annen produksjonsdag`);
          map[b.id].location.push(`Lokasjonen brukes også av en annen produksjonsdag`);
        }

        if (sharedCrew.length > 0) {
          map[a.id].crew.push(`Crew-kollisjon: ${sharedCrew.length} person(er) er dobbeltbooket`);
          map[b.id].crew.push(`Crew-kollisjon: ${sharedCrew.length} person(er) er dobbeltbooket`);
        }

        if (sharedProps.length > 0) {
          map[a.id].props.push(`Utstyr/rekvisitt-kollisjon: ${sharedProps.length} element(er) overlapper`);
          map[b.id].props.push(`Utstyr/rekvisitt-kollisjon: ${sharedProps.length} element(er) overlapper`);
        }
      }
    }

    Object.values(map).forEach((summary) => {
      summary.total = summary.crew.length + summary.location.length + summary.props.length + summary.time.length;
    });

    return map;
  }, [productionDays]);

  const getReadiness = (day: NormalizedProductionDay): ReadinessResult => {
    const dayCache = dayDataCache[day.id];
    const meta = proMetaByDay[day.id] || {};
    const reasons: string[] = [];
    let score = 100;

    if (!day.locationId) {
      reasons.push('Mangler lokasjon');
      score -= 25;
    }
    if (!Array.isArray(day.scenes) || day.scenes.length === 0) {
      reasons.push('Ingen scener tilordnet');
      score -= 20;
    }
    if (!Array.isArray(day.crew) || day.crew.length === 0) {
      reasons.push('Ingen crew tilordnet');
      score -= 22;
    }
    if (!Array.isArray(day.props) || day.props.length === 0) {
      reasons.push('Ingen utstyr/rekvisitter tilordnet');
      score -= 10;
    }
    if (dayCache?.validation?.errors?.length) {
      reasons.push(`Har ${dayCache.validation.errors.length} valideringsfeil`);
      score -= Math.min(28, dayCache.validation.errors.length * 10);
    }
    if (dayCache?.validation?.warnings?.length) {
      reasons.push(`Har ${dayCache.validation.warnings.length} advarsler`);
      score -= Math.min(14, dayCache.validation.warnings.length * 4);
    }
    if (!meta.permitsReady) {
      reasons.push('Tillatelser ikke bekreftet');
      score -= 12;
    }
    if (!meta.transportReady) {
      reasons.push('Transport ikke bekreftet');
      score -= 8;
    }

    const conflicts = conflictMap[day.id];
    if (conflicts?.total) {
      reasons.push(`${conflicts.total} registrerte kollisjoner`);
      score -= Math.min(32, conflicts.total * 8);
    }

    const safeScore = Math.max(0, Math.min(100, score));
    if (safeScore < 55) {
      return { level: 'blokkert', score: safeScore, reasons };
    }
    if (safeScore < 80) {
      return { level: 'risiko', score: safeScore, reasons };
    }
    return {
      level: 'klar',
      score: safeScore,
      reasons: reasons.length > 0 ? reasons : ['Sjekklisten er grønn'],
    };
  };

  const readinessByDay = useMemo<Record<string, ReadinessResult>>(() => {
    const result: Record<string, ReadinessResult> = {};
    productionDays.forEach((day) => {
      result[day.id] = getReadiness(day);
    });
    return result;
  }, [productionDays, dayDataCache, proMetaByDay, conflictMap]);

  const getReadinessColor = (level: ReadinessLevel): string => {
    if (level === 'klar') return '#10b981';
    if (level === 'risiko') return '#ffb800';
    return '#ef4444';
  };

  const getReadinessLabel = (level: ReadinessLevel): string => {
    if (level === 'klar') return 'Klar';
    if (level === 'risiko') return 'Risiko';
    return 'Blokkert';
  };

  const getRiskSignals = (day: NormalizedProductionDay): string[] => {
    const risks: string[] = [];
    const meta = proMetaByDay[day.id] || {};
    const start = parseClockMinutes(day.callTime);
    const endRaw = parseClockMinutes(day.wrapTime);
    const end = start !== null && endRaw !== null && endRaw < start ? endRaw + 24 * 60 : endRaw;

    if (start !== null && (start < 6 * 60 || start >= 22 * 60)) {
      risks.push('Natt-/tidlig call time');
    }
    if (end !== null && end > 22 * 60) {
      risks.push('Sen wrap (overtidsrisiko)');
    }
    if (!meta.permitsReady) {
      risks.push('Tillatelser ikke markert som klar');
    }
    if (!meta.transportReady) {
      risks.push('Transportplan ikke markert som klar');
    }
    if ((conflictMap[day.id]?.total || 0) > 0) {
      risks.push('Aktive ressurskollisjoner');
    }
    const symbol = String((day as any)?.weatherForecast?.forecast?.[0]?.symbol || '').toLowerCase();
    if (symbol.includes('thunder') || symbol.includes('storm')) {
      risks.push('Værrisiko: torden/storm');
    }
    if ((Array.isArray(day.crew) ? day.crew.length : 0) < 2) {
      risks.push('Lav bemanning');
    }
    return risks;
  };

  const sortedProductionDays = useMemo(
    () => [...productionDays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [productionDays]
  );

  const getDependencyIssues = (day: NormalizedProductionDay): string[] => {
    const issues: string[] = [];
    const dayIndex = sortedProductionDays.findIndex((item) => item.id === day.id);
    const previousDay = dayIndex > 0 ? sortedProductionDays[dayIndex - 1] : null;
    if (previousDay && previousDay.status !== 'completed' && day.status !== 'planned') {
      issues.push(`Forrige dag (${new Date(previousDay.date).toLocaleDateString('nb-NO')}) er ikke fullført`);
    }

    const deps = proMetaByDay[day.id]?.dependencies || [];
    deps.forEach((depId) => {
      const depDay = productionDays.find((item) => item.id === depId);
      if (!depDay) return;
      if (depDay.status !== 'completed') {
        issues.push(`Avhengig av ${new Date(depDay.date).toLocaleDateString('nb-NO')} (${getStatusLabel(depDay.status)})`);
      }
    });
    return issues;
  };

  const selectedProDay = useMemo(
    () => productionDays.find((day) => day.id === proSelectedDayId) || null,
    [productionDays, proSelectedDayId]
  );

  const proKpis = useMemo(() => {
    const totalPlanned = productionDays.reduce((sum, day) => sum + plannedMinutesForDay(day), 0);
    const totalActual = productionDays.reduce((sum, day) => {
      const actual = proMetaByDay[day.id]?.actualMinutes;
      if (typeof actual === 'number') return sum + actual;
      if (day.status === 'completed') return sum + plannedMinutesForDay(day);
      return sum;
    }, 0);
    const completedCount = productionDays.filter((day) => day.status === 'completed').length;
    const delayedCount = productionDays.filter((day) => {
      const dayDate = new Date(day.date).getTime();
      const today = new Date().setHours(0, 0, 0, 0);
      return dayDate < today && day.status !== 'completed' && day.status !== 'cancelled';
    }).length;
    const avgReadiness =
      productionDays.length === 0
        ? 0
        : Math.round(
            productionDays.reduce((sum, day) => sum + (readinessByDay[day.id]?.score || 0), 0) /
              productionDays.length
          );
    return {
      totalPlanned,
      totalActual,
      overtime: Math.max(0, totalActual - totalPlanned),
      coveragePercent: productionDays.length ? Math.round((completedCount / productionDays.length) * 100) : 0,
      delayedCount,
      avgReadiness,
    };
  }, [productionDays, readinessByDay, proMetaByDay]);

  const extractMentions = (text: string): string[] => {
    const explicit = globalTagService.parseExplicitMentions(text);
    const implicit = mentionDirectory.filter((name) => text.toLowerCase().includes(name.toLowerCase()));
    return Array.from(new Set([...explicit, ...implicit]));
  };

  const levenshtein = (a: string, b: string): number => {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= a.length; j += 1) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i += 1) {
      for (let j = 1; j <= a.length; j += 1) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  const getDidYouMeanMention = (rawTag: string): string | null => {
    if (!rawTag) return null;
    const normalized = rawTag.toLowerCase();
    const exact = mentionDirectory.find((name) => name.toLowerCase() === normalized);
    if (exact) return null;
    const scored = mentionDirectory
      .map((name) => ({ name, distance: levenshtein(normalized, name.toLowerCase()) }))
      .sort((a, b) => a.distance - b.distance);
    if (scored[0] && scored[0].distance <= 2) return scored[0].name;
    return null;
  };

  const selectedDraft = selectedProDay ? teamFlowDraftByDay[selectedProDay.id] || '' : '';

  const selectedDraftMentions = useMemo(() => {
    if (!selectedProDay) return [];
    return extractMentions(selectedDraft);
  }, [selectedDraft, selectedProDay, mentionDirectory]);

  const selectedDidYouMean = useMemo(() => {
    const rawTag = (selectedDraft.match(/@([A-Za-z0-9_.\-ÆØÅæøå]+)/g) || [])
      .map((tag) => tag.replace(/^@/, ''))
      .find(Boolean);
    return rawTag ? { rawTag, suggestion: getDidYouMeanMention(rawTag) } : null;
  }, [selectedDraft, mentionDirectory]);

  const updateDayMeta = (dayId: string, updater: (previous: ProductionDayProMeta) => ProductionDayProMeta) => {
    setProMetaByDay((prev) => {
      const base = prev[dayId] || {};
      return {
        ...prev,
        [dayId]: updater(base),
      };
    });
  };

  const addTeamFlowEntry = (dayId: string, type: TeamFlowEntryType) => {
    const draft = (teamFlowDraftByDay[dayId] || '').trim();
    if (!draft) return;
    const entry: TeamFlowEntry = {
      id: `team-flow-${Date.now()}`,
      author: getCurrentUser(),
      createdAt: new Date().toISOString(),
      type,
      text: draft,
      mentions: extractMentions(draft),
    };
    updateDayMeta(dayId, (previous) => ({
      ...previous,
      teamFlow: [...(previous.teamFlow || []), entry],
    }));
    setTeamFlowDraftByDay((prev) => ({ ...prev, [dayId]: '' }));
    void globalTagService
      .add([entry.author, ...entry.mentions, ...globalTagService.parseExplicitMentions(entry.text)])
      .then((tags) => {
        setGlobalTagRegistry(tags);
      });
  };

  const replaceDraftMention = (dayId: string, from: string, to: string) => {
    setTeamFlowDraftByDay((prev) => {
      const current = prev[dayId] || '';
      return {
        ...prev,
        [dayId]: current.replace(new RegExp(`@?${from}`, 'ig'), `@${to}`),
      };
    });
  };

  const applyDraftSuggestion = (dayId: string, suggestion: string) => {
    setTeamFlowDraftByDay((prev) => {
      const current = prev[dayId] || '';
      if (!current.trim()) {
        return { ...prev, [dayId]: suggestion };
      }

      if (/@([A-Za-z0-9_.\-ÆØÅæøå]*)$/u.test(current)) {
        return {
          ...prev,
          [dayId]: current.replace(/@([A-Za-z0-9_.\-ÆØÅæøå]*)$/u, `@${suggestion}`),
        };
      }

      if (/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u.test(current)) {
        return {
          ...prev,
          [dayId]: current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, suggestion),
        };
      }

      return { ...prev, [dayId]: `${current.trimEnd()} ${suggestion}` };
    });
  };

  const enqueueOfflineItem = (dayId: string, action: OfflineFieldQueueItem['action'], status?: ProductionDay['status']) => {
    const queueItem: OfflineFieldQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dayId,
      action,
      payload: {
        status,
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };
    setOfflineQueue((prev) => [...prev, queueItem]);
  };

  const applyFieldStatus = async (
    day: NormalizedProductionDay,
    status: ProductionDayStatus,
    action: OfflineFieldQueueItem['action']
  ) => {
    const nowIso = new Date().toISOString();
    updateDayMeta(day.id, (previous) => ({
      ...previous,
      checkInAt: action === 'check_in' ? nowIso : previous.checkInAt,
      checkOutAt: action === 'check_out' ? nowIso : previous.checkOutAt,
      actualMinutes:
        action === 'check_out' && previous.checkInAt
          ? Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(previous.checkInAt).getTime()) / 60000))
          : previous.actualMinutes,
      lastFieldStatus: status,
    }));

    if (!isOnline) {
      enqueueOfflineItem(day.id, action, status);
      showInfo('Offline: endringen er lagt i synk-kø');
      return;
    }

    try {
      await productionPlanningService.saveProductionDay(projectId, {
        ...day,
        status,
        updatedAt: nowIso,
      });
      const days = await productionPlanningService.getProductionDays(projectId);
      setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
    } catch (error) {
      console.error('Field status update failed, queued offline instead:', error);
      enqueueOfflineItem(day.id, action, status);
    }
  };

  const shiftIsoDate = (dateIso: string, days: number): string => {
    const date = new Date(dateIso);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const bulkShiftPreview = useMemo(() => {
    const items = [...selectedIds]
      .map((id) => productionDays.find((day) => day.id === id))
      .filter((day): day is NormalizedProductionDay => !!day)
      .map((day) => ({
        id: day.id,
        from: day.date,
        to: shiftIsoDate(day.date, bulkShiftDays),
      }));
    return items;
  }, [selectedIds, productionDays, bulkShiftDays]);

  const applyBulkShift = async () => {
    if (bulkShiftPreview.length === 0) {
      setShowBulkShiftDialog(false);
      return;
    }
    for (const item of bulkShiftPreview) {
      const day = productionDays.find((candidate) => candidate.id === item.id);
      if (!day) continue;
      await productionPlanningService.saveProductionDay(projectId, {
        ...day,
        date: item.to,
        updatedAt: new Date().toISOString(),
      });
    }
    const days = await productionPlanningService.getProductionDays(projectId);
    setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
    setShowBulkShiftDialog(false);
    showSuccess(`Flyttet ${bulkShiftPreview.length} produksjonsdag(er) med ${bulkShiftDays} dag(er)`);
  };

  const applyDragMove = async () => {
    if (!draggingDayId || !dragTargetDayId || draggingDayId === dragTargetDayId) {
      setShowDragPreviewDialog(false);
      setDraggingDayId(null);
      setDragTargetDayId(null);
      return;
    }
    const source = productionDays.find((day) => day.id === draggingDayId);
    const target = productionDays.find((day) => day.id === dragTargetDayId);
    if (!source || !target) {
      setShowDragPreviewDialog(false);
      setDraggingDayId(null);
      setDragTargetDayId(null);
      return;
    }
    await productionPlanningService.saveProductionDay(projectId, {
      ...source,
      date: target.date,
      updatedAt: new Date().toISOString(),
    });
    const days = await productionPlanningService.getProductionDays(projectId);
    setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
    setShowDragPreviewDialog(false);
    setDraggingDayId(null);
    setDragTargetDayId(null);
    showSuccess('Dag flyttet via drag/drop');
  };

  const generateCallSheetForDay = (day: NormalizedProductionDay) => {
    const relatedCrew = (Array.isArray(day.crew) ? day.crew : [])
      .map((crewId) => crew.find((member: any) => member.id === crewId))
      .filter(Boolean);
    const relatedProps = (Array.isArray(day.props) ? day.props : [])
      .map((propId) => props.find((item: any) => item.id === propId))
      .filter(Boolean);

    const html = `
      <!doctype html>
      <html lang="nb">
      <head>
        <meta charset="UTF-8" />
        <title>Call sheet ${day.date}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0a0f1c; color:#f8fafc; padding:24px; }
          .sheet { border:1px solid rgba(156,39,176,.35); border-radius:16px; padding:20px; background:linear-gradient(160deg, rgba(124,58,237,.22), rgba(6,182,212,.1)); }
          h1 { margin:0 0 8px; font-size:28px; }
          h2 { margin:20px 0 8px; font-size:16px; color:#c4b5fd; text-transform:uppercase; letter-spacing:.08em; }
          .meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
          .card { background:rgba(15,23,42,.65); border:1px solid rgba(148,163,184,.2); border-radius:12px; padding:12px; }
          ul { margin:0; padding-left:18px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <h1>Role Room Call Sheet</h1>
          <div>${new Date(day.date).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div class="meta" style="margin-top:16px">
            <div class="card"><strong>Lokasjon</strong><br/>${getLocationName(day.locationId)}</div>
            <div class="card"><strong>Arbeidstid</strong><br/>${day.callTime} – ${day.wrapTime}</div>
            <div class="card"><strong>Status</strong><br/>${getStatusLabel(day.status)}</div>
          </div>
          <h2>Crew (${relatedCrew.length})</h2>
          <ul>${relatedCrew.map((member: any) => `<li>${member.name} · ${member.role || 'Crew'}</li>`).join('') || '<li>Ingen crew tilordnet</li>'}</ul>
          <h2>Scener (${Array.isArray(day.scenes) ? day.scenes.length : 0})</h2>
          <ul>${(Array.isArray(day.scenes) ? day.scenes : []).map((sceneId) => {
            const scene = availableScenes.find((item) => item.id === sceneId);
            return `<li>${scene?.name || sceneId}</li>`;
          }).join('') || '<li>Ingen scener tilordnet</li>'}</ul>
          <h2>Utstyr / rekvisitter (${relatedProps.length})</h2>
          <ul>${relatedProps.map((item: any) => `<li>${item.name}${item.category ? ` · ${item.category}` : ''}</li>`).join('') || '<li>Ingen utstyr/rekvisitter tilordnet</li>'}</ul>
          <h2>Notater</h2>
          <div class="card">${day.notes || 'Ingen notater registrert'}</div>
        </div>
      </body>
      </html>
    `;
    const sheetWindow = window.open('', '_blank');
    if (!sheetWindow) {
      showError('Kunne ikke åpne call sheet-vindu');
      return;
    }
    sheetWindow.document.write(html);
    sheetWindow.document.close();
    setTimeout(() => sheetWindow.print(), 150);
  };

  const selectedConflictSummary = selectedProDay ? conflictMap[selectedProDay.id] : undefined;
  const selectedReadiness = selectedProDay ? readinessByDay[selectedProDay.id] : undefined;
  const selectedRisks = selectedProDay ? getRiskSignals(selectedProDay) : [];
  const selectedDependencies = selectedProDay ? getDependencyIssues(selectedProDay) : [];
  const selectedTeamFlow: TeamFlowEntry[] = selectedProDay
    ? proMetaByDay[selectedProDay.id]?.teamFlow ?? []
    : [];
  const selectedMentionQuery = (selectedDraft.match(/@([A-Za-z0-9_.\-ÆØÅæøå]*)$/) || [])[1] || '';
  const selectedMentionSuggestions =
    selectedMentionQuery.length === 0
      ? []
      : mentionDirectory
          .filter((name) => name.toLowerCase().includes(selectedMentionQuery.toLowerCase()))
          .slice(0, 6);

  // Handlers
  const handleOpenDialog = (day?: NormalizedProductionDay) => {
    if (day) {
      setEditingDay(day);
      setFormData(day);
    } else {
      setEditingDay(null);
      const defaultTiming = getDefaultTiming();
      setFormData({
        date: new Date().toISOString().split('T')[0],
        callTime: defaultTiming.callTime,
        wrapTime: defaultTiming.wrapTime,
        locationId: locations.length > 0 ? locations[0].id : '',
        scenes: [],
        crew: [],
        props: [],
        notes: '',
        status: 'planned',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDay(null);
  };

  const loadWeatherForecast = async (locationId: string, date: string) => {
    const location = locations.find(l => l.id === locationId);
    if (!location?.coordinates) return null;

    try {
      const today = new Date();
      const targetDate = new Date(date);
      const dayOffset = Number.isFinite(targetDate.getTime())
        ? Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const requestedDays = Math.min(Math.max(dayOffset + 1, 1), 7);
      const forecast = await externalDataService.getWeatherForecast({
        lat: location.coordinates.lat,
        lon: location.coordinates.lng,
        days: requestedDays,
      });
      return forecast;
    } catch (error) {
      console.error('Failed to load weather forecast:', error);
      return null;
    }
  };

  // Get current user name (could be from auth context in a real app)
  const getCurrentUser = () => {
    // For demo purposes, use a default user until auth integration is available
    return 'Demo Bruker';
  };

  const handleSave = async (skipTeamNotification = false) => {
    if (!formData.date || !formData.locationId) {
      showError('⚠️ Dato og lokasjon er påkrevd');
      return;
    }

    let weatherForecast = undefined;
    if (formData.locationId) {
      const forecast = await loadWeatherForecast(formData.locationId, formData.date || '');
      if (forecast) {
        weatherForecast = forecast;
      }
    }

    const currentUser = getCurrentUser();
    const now = new Date().toISOString();

    // Build change description for log
    const buildChangeDescription = (): string => {
      if (!editingDay) return 'Opprettet produksjonsdag';
      const changes: string[] = [];
      if (editingDay.date !== formData.date) changes.push('dato');
      if (editingDay.callTime !== formData.callTime) changes.push('call time');
      if (editingDay.wrapTime !== formData.wrapTime) changes.push('wrap time');
      if (editingDay.locationId !== formData.locationId) changes.push('lokasjon');
      if (editingDay.status !== formData.status) changes.push('status');
      if (editingDay.notes !== formData.notes) changes.push('notater');
      if (JSON.stringify(editingDay.scenes) !== JSON.stringify(formData.scenes)) changes.push('scener');
      if (JSON.stringify(editingDay.crew) !== JSON.stringify(formData.crew)) changes.push('team');
      if (JSON.stringify(editingDay.props) !== JSON.stringify(formData.props)) changes.push('rekvisitter');
      return changes.length > 0 ? `Endret: ${changes.join(', ')}` : 'Ingen synlige endringer';
    };

    const productionDay: NormalizedProductionDay = editingDay
      ? normalizeProductionDay({
          ...editingDay,
          ...formData,
          weatherForecast: weatherForecast || editingDay.weatherForecast,
          updatedAt: now,
          lastModifiedBy: currentUser,
          changeLog: [
            ...getDayChangeLog(editingDay),
            {
              timestamp: now,
              user: currentUser,
              action: editingDay.status !== formData.status ? 'status_changed' : 'updated',
              changes: buildChangeDescription(),
            },
          ],
        })
      : normalizeProductionDay({
          id: `production-day-${Date.now()}`,
          projectId,
          date: formData.date || '',
          callTime: formData.callTime || '09:00',
          wrapTime: formData.wrapTime || '17:00',
          locationId: formData.locationId || '',
          scenes: formData.scenes || [],
          crew: formData.crew || [],
          props: formData.props || [],
          notes: formData.notes || '',
          status: formData.status || 'planned',
          weatherForecast: weatherForecast,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUser,
          lastModifiedBy: currentUser,
          changeLog: [{
            timestamp: now,
            user: currentUser,
            action: 'created',
            changes: 'Opprettet produksjonsdag',
          }],
        });

    // Check if important fields have changed (only when editing)
    if (editingDay && !skipTeamNotification) {
      const changes: string[] = [];

      if (editingDay.date !== formData.date) {
        changes.push('Dato');
      }
      if (editingDay.callTime !== formData.callTime || editingDay.wrapTime !== formData.wrapTime) {
        changes.push('Arbeidstid');
      }
      if (editingDay.locationId !== formData.locationId) {
        changes.push('Lokasjon');
      }
      if (editingDay.notes !== formData.notes && formData.notes && formData.notes.trim() !== '') {
        changes.push('Notater');
      }

      if (changes.length > 0) {
        setChangedFields(changes);
        setPendingSaveData(productionDay);
        setShowInformTeamDialog(true);
        return;
      }
    }

    // Save directly
    await productionPlanningService.saveProductionDay(projectId, productionDay);
    const days = await productionPlanningService.getProductionDays(projectId);
    setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);

    // Show success notification
    if (editingDay) {
      showSuccess('✅ Produksjonsdag oppdatert', 3000);
    } else {
      showSuccess('🎬 Ny produksjonsdag opprettet', 3000);
    }

    handleCloseDialog();
    if (onUpdate) onUpdate();
  };

  const handleConfirmSaveWithNotification = async (notify: boolean) => {
    if (pendingSaveData) {
      await productionPlanningService.saveProductionDay(projectId, pendingSaveData);
      const days = await productionPlanningService.getProductionDays(projectId);
      setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);

      if (notify) {
        // Show notification with notistack
        showWarning(`📢 Husk å informere teamet om: ${changedFields.join(', ')}`, 8000);
        showSuccess('✅ Produksjonsdag oppdatert', 4000);
      } else {
        showSuccess('✅ Produksjonsdag lagret', 3000);
      }
    }

    setShowInformTeamDialog(false);
    setPendingSaveData(null);
    setChangedFields([]);
    handleCloseDialog();
    if (onUpdate) onUpdate();
  };

  const handleDeleteWithUndo = async (dayId: string) => {
    const day = productionDays.find((d) => d.id === dayId);
    if (day) {
      try {
        setDeletedDay(day);
        await productionPlanningService.deleteProductionDay(projectId, dayId);
        const days = await productionPlanningService.getProductionDays(projectId);
        setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
        setUndoSnackbarOpen(true);
        showInfo('🗑️ Produksjonsdag slettet - klikk "Angre" for å gjenopprette', 6000);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting production day:', error);
        showError('Feil ved sletting av produksjonsdag');
      }
    }
  };

  const handleUndoDelete = async () => {
    if (deletedDay) {
      try {
        await productionPlanningService.saveProductionDay(projectId, deletedDay);
        const days = await productionPlanningService.getProductionDays(projectId);
        setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
        setDeletedDay(null);
        setUndoSnackbarOpen(false);
        showSuccess('↩️ Produksjonsdag gjenopprettet', 3000);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error undoing delete:', error);
        showError('Feil ved gjenoppretting av produksjonsdag');
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

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedDays.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedDays.map((d) => d.id)));
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
    if (window.confirm(`Er du sikker på at du vil slette ${selectedIds.size} produksjonsdag(er)?`)) {
      try {
        for (const id of selectedIds) {
          await productionPlanningService.deleteProductionDay(projectId, id);
        }
        const days = await productionPlanningService.getProductionDays(projectId);
        setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
        setSelectedIds(new Set());
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting production days:', error);
        showError('Feil ved sletting av produksjonsdager');
      }
    }
  };

  const handleDuplicate = async (day: NormalizedProductionDay) => {
    const currentUser = getCurrentUser();
    const now = new Date().toISOString();
    const newDay: NormalizedProductionDay = normalizeProductionDay({
      ...day,
      id: `production-day-${Date.now()}`,
      date: new Date(new Date(day.date).getTime() + 86400000).toISOString().split('T')[0],
      status: 'planned',
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser,
      lastModifiedBy: currentUser,
      changeLog: [{
        timestamp: now,
        user: currentUser,
        action: 'created',
        changes: `Duplisert fra ${new Date(day.date).toLocaleDateString('nb-NO')}`,
      }],
    });
    await productionPlanningService.saveProductionDay(projectId, newDay);
    const days = await productionPlanningService.getProductionDays(projectId);
    setProductionDays(Array.isArray(days) ? days.map(normalizeProductionDay) : []);
    showSuccess(`📋 Produksjonsdag duplisert til ${new Date(newDay.date).toLocaleDateString('nb-NO')}`, 4000);
    if (onUpdate) onUpdate();
  };

  const handleExportCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        showError('❌ Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateProductionDaysHTML(project, productionDays, locations);

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
      console.error('Error exporting production days:', error);
      alert('Kunne ikke eksportere produksjonsdager');
    }
  };

  const generateProductionDaysHTML = (
    project: { id: string; name: string },
    productionDays: NormalizedProductionDay[],
    locations: Location[]
  ): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalDays = productionDays.length;
    const completedDays = productionDays.filter(d => d.status === 'completed').length;
    const inProgressDays = productionDays.filter(d => d.status === 'in_progress').length;
    const completedPercent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    const productionIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9c27b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`;

    const getLocationName = (locationId?: string): string => {
      if (!locationId) return 'Ingen lokasjon';
      const location = locations.find((entry) => entry.id === locationId);
      return location?.name ?? locationId;
    };

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Produksjonsdager</title>
  <style>
    @page { margin: 0; counter-increment: page; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.7; padding: 0; background: #fff; font-size: 14px; }
    .page { padding: 50px 60px 80px 60px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #9c27b0; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #9c27b0; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #9c27b0; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #9c27b0; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #9c27b0; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .progress-bar { width: 100%; height: 6px; background: #e2e8f0; border-radius: 10px; margin-top: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #9c27b0 0%, #7b1fa2 100%); border-radius: 10px; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    td { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 400; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-planned { background: #ffb800; color: white; }
    .badge-in_progress { background: #00d4ff; color: white; }
    .badge-completed { background: #10b981; color: white; }
    .badge-cancelled { background: #ef4444; color: white; }
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
        ${productionIconSVG}
        ${project.name} - Produksjonsdager
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${productionIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalDays}</span>
          <span class="summary-label">Totale Dager</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${inProgressDays}</span>
          <span class="summary-label">Pågående</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${completedDays}</span>
          <span class="summary-label">Fullførte</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${completedPercent}%"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${productionIconSVG}</span>
          Produksjonsdager
        </div>
        <span class="section-count">${totalDays} dag${totalDays !== 1 ? 'er' : ''}</span>
      </div>
      <div class="section-content">
        ${productionDays.length === 0
          ? '<div class="empty-state">Ingen produksjonsdager ennå</div>'
          : `<table>
          <thead>
            <tr>
              <th style="width: 12%;">Dato</th>
              <th style="width: 20%;">Lokasjon</th>
              <th style="width: 10%;">Call Time</th>
              <th style="width: 10%;">Wrap Time</th>
              <th style="width: 12%;">Status</th>
              <th style="width: 8%;">Scener</th>
              <th style="width: 8%;">Team</th>
              <th style="width: 20%;">Notater</th>
            </tr>
          </thead>
          <tbody>
            ${productionDays.map((day) => {
              const statusBadgeClass = day.status === 'completed' ? 'badge-completed' : day.status === 'in_progress' ? 'badge-in_progress' : day.status === 'cancelled' ? 'badge-cancelled' : 'badge-planned';
              const notes = day.notes || '-';
              return `<tr>
              <td><strong>${new Date(day.date).toLocaleDateString('nb-NO')}</strong></td>
              <td style="font-size: 13px;">${getLocationName(day.locationId)}</td>
              <td style="text-align: center;">${day.callTime || '-'}</td>
              <td style="text-align: center;">${day.wrapTime || '-'}</td>
              <td><span class="badge ${statusBadgeClass}">${getStatusLabel(day.status)}</span></td>
              <td style="text-align: center;">${day.scenes.length}</td>
              <td style="text-align: center;">${day.crew.length}</td>
              <td style="font-size: 13px;">${notes.length > 60 ? notes.substring(0, 60) + '...' : notes}</td>
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

  return (
    <Box
      component="section"
      aria-labelledby="prodday-panel-title"
      sx={{ p: { xs: 2, sm: 3, md: containerPadding } }}
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
        }}
      >
        {/* Title with icon - Enhanced visibility */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            py: { xs: 1, sm: 1.5 },
          }}
        >
          <Box
            sx={{
              width: { xs: 48, sm: 56, md: 64 },
              height: { xs: 48, sm: 56, md: 64 },
              borderRadius: { xs: 2, sm: 3 },
              background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.25) 0%, rgba(156, 39, 176, 0.15) 100%)',
              border: '2px solid rgba(156, 39, 176, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(156, 39, 176, 0.2)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(156, 39, 176, 0.3)',
              },
            }}
          >
            <CalendarMonthIcon
              sx={{
                color: '#ce93d8',
                fontSize: { xs: 26, sm: 32, md: 36 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id="prodday-panel-title"
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #fff 0%, #ce93d8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Produksjonskalender
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.87)',
                fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.9375rem' },
                fontWeight: 500,
                mt: 0.25,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <ScheduleIcon sx={{ fontSize: { xs: 14, sm: 16 }, opacity: 0.7 }} />
              Planlegg dag-for-dag produksjon
            </Typography>
          </Box>
        </Box>

        {/* Action buttons */}
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.5, sm: 1 },
            flexWrap: 'wrap',
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
          }}
        >
          <Tooltip title="Eksporter til CSV (Ctrl+E)">
            <Button
              variant="outlined"
              onClick={handleExportCSV}
              aria-label="Eksporter produksjonsdager til CSV"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: 'rgba(255,255,255,0.87)',
                borderColor: 'rgba(255,255,255,0.2)',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
              }}
            >
              <ExportIcon />
              {showExtendedLabels && <Box component="span" sx={{ ml: 1 }}>Eksporter</Box>}
            </Button>
          </Tooltip>

          <Tooltip title={filtersExpanded ? 'Skjul avanserte filtre' : 'Vis avanserte filtre'}>
            <Button
              variant="outlined"
              onClick={() => setShowFilters((previous) => !previous)}
              aria-pressed={filtersExpanded}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: filtersExpanded ? '#9c27b0' : 'rgba(255,255,255,0.7)',
                borderColor: filtersExpanded ? '#9c27b0' : 'rgba(255,255,255,0.2)',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
              }}
            >
              <FilterIcon />
              {showExtendedLabels && (
                <Box component="span" sx={{ ml: 1, display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  Filtre
                  {filtersExpanded ? <CollapseIcon sx={{ fontSize: 18 }} /> : <ExpandIcon sx={{ fontSize: 18 }} />}
                </Box>
              )}
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
                color: showStats ? '#9c27b0' : 'rgba(255,255,255,0.7)',
                borderColor: showStats ? '#9c27b0' : 'rgba(255,255,255,0.2)',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
              }}
            >
              <StatsIcon />
              {showExtendedLabels && <Box component="span" sx={{ ml: 1 }}>Statistikk</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Legg til produksjonsdag (Ctrl+N)">
            <span>
            <Button
              variant="contained"
              onClick={() => handleOpenDialog()}
              disabled={locations.length === 0}
              aria-label="Legg til ny produksjonsdag"
              sx={{
                bgcolor: '#9c27b0',
                color: '#fff',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                flex: { xs: 1, sm: 'none' },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#7b1fa2' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' },
              }}
            >
              <AddIcon />
              {showExtendedLabels && <Box component="span" sx={{ ml: 1 }}>Legg til dag</Box>}
            </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* Warning if no locations */}
      {locations.length === 0 && (
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            bgcolor: 'rgba(255,184,0,0.1)',
            color: '#ffb800',
            border: '1px solid rgba(255,184,0,0.3)',
            '& .MuiAlert-icon': { color: '#ffb800' },
          }}
        >
          Du må legge til minst én lokasjon før du kan opprette produksjonsdager.
        </Alert>
      )}

      {/* Statistics Panel - Responsive */}
      <Collapse in={showStats}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(auto-fit, minmax(120px, 1fr))' },
            gap: { xs: 1.5, sm: 2 },
            mb: 2,
            p: { xs: 1.5, sm: 2 },
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 2,
          }}
          role="region"
          aria-label="Statistikk over produksjonsdager"
        >
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <CalendarMonthIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#9c27b0' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#9c27b0', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.totalDays}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Totalt dager</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#10b981' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.statusCount['completed'] || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Fullført</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <CalendarMonthIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffb800' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffb800', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.statusCount['planned'] || 0}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Planlagt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <MovieIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#2196f3' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.totalScenes}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Scener</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.favorites}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Favoritter</Typography>
          </Box>
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
        }}
      >
        <TextField
          placeholder={isMobile ? 'Søk...' : 'Søk etter dato, lokasjon...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1 }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i produksjonsdager' },
          }}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
            },
          }}
        />
      </Box>

      <Collapse in={filtersExpanded}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: { xs: 1, sm: 2 },
            mb: 2,
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtrer etter status"
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#9c27b0' },
              }}
            >
              <MenuItem value="all">Alle statuser</MenuItem>
              <MenuItem value="planned">Planlagt</MenuItem>
              <MenuItem value="in_progress">Pågår</MenuItem>
              <MenuItem value="completed">Fullført</MenuItem>
              <MenuItem value="cancelled">Kansellert</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Tooltip title="Kortvisning">
              <Button
                variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                sx={{
                  minHeight: TOUCH_TARGET_SIZE,
                  minWidth: TOUCH_TARGET_SIZE,
                  bgcolor: viewMode === 'grid' ? 'rgba(156,39,176,0.2)' : 'transparent',
                  color: viewMode === 'grid' ? '#9c27b0' : 'rgba(255,255,255,0.7)',
                  borderColor: viewMode === 'grid' ? '#9c27b0' : 'rgba(255,255,255,0.2)',
                  ...focusVisibleStyles,
                }}
              >
                <GridViewIcon />
                {showExtendedLabels && <Box component="span" sx={{ ml: 1 }}>Kort</Box>}
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
                  bgcolor: viewMode === 'table' ? 'rgba(156,39,176,0.2)' : 'transparent',
                  color: viewMode === 'table' ? '#9c27b0' : 'rgba(255,255,255,0.7)',
                  borderColor: viewMode === 'table' ? '#9c27b0' : 'rgba(255,255,255,0.2)',
                  ...focusVisibleStyles,
                }}
              >
                <TableViewIcon />
                {showExtendedLabels && <Box component="span" sx={{ ml: 1 }}>Tabell</Box>}
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
                    ...focusVisibleStyles,
                    '&:hover': { bgcolor: '#cc0000' },
                  }}
                >
                  <DeleteIcon />
                  <Box component="span" sx={{ ml: 0.5 }}>{selectedIds.size}</Box>
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Collapse>

      {/* Pro view */}
      <Box
        sx={{
          mb: 2,
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2,
          border: '1px solid rgba(124,58,237,0.35)',
          background:
            'linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(8,145,178,0.08) 100%)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1rem' } }}>
              Pro visning: operativ produksjonsstyring
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>
              Konflikter, readiness, call sheet, avhengigheter, risiko, teamflyt, KPI og feltmodus
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Switch
                  checked={proViewEnabled}
                  onChange={(event) => setProViewEnabled(event.target.checked)}
                  color="secondary"
                />
              }
              label={<Typography sx={{ color: '#e9d5ff', fontSize: '0.8rem' }}>Pro</Typography>}
            />
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Switch
                  checked={fieldModeEnabled}
                  onChange={(event) => setFieldModeEnabled(event.target.checked)}
                  color="secondary"
                />
              }
              label={<Typography sx={{ color: '#67e8f9', fontSize: '0.8rem' }}>Feltmodus</Typography>}
            />
            <Chip
              icon={isOnline ? <OnlineIcon /> : <OfflineIcon />}
              label={isOnline ? `Online${offlineQueue.length > 0 ? ` · kø ${offlineQueue.length}` : ''}` : `Offline · kø ${offlineQueue.length}`}
              sx={{
                bgcolor: isOnline ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                color: '#fff',
                border: `1px solid ${isOnline ? 'rgba(16,185,129,0.45)' : 'rgba(239,68,68,0.45)'}`,
              }}
            />
          </Box>
        </Box>

        <Collapse in={proViewEnabled} mountOnEnter>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 260 } }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.8)' }}>Fokusdag</InputLabel>
                <Select
                  value={proSelectedDayId || ''}
                  label="Fokusdag"
                  onChange={(event) => setProSelectedDayId(String(event.target.value))}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#a855f7' },
                  }}
                >
                  {filteredAndSortedDays.map((day) => (
                    <MenuItem key={day.id} value={day.id}>
                      {new Date(day.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })} · {getLocationName(day.locationId)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedProDay && (
                <Button
                  variant="outlined"
                  startIcon={<CallSheetIcon />}
                  onClick={() => generateCallSheetForDay(selectedProDay)}
                  sx={{
                    minHeight: TOUCH_TARGET_SIZE,
                    color: '#67e8f9',
                    borderColor: 'rgba(103,232,249,0.5)',
                  }}
                >
                  Call sheet
                </Button>
              )}

              <Button
                variant="outlined"
                startIcon={<RescheduleIcon />}
                onClick={() => setShowBulkShiftDialog(true)}
                disabled={selectedIds.size === 0}
                sx={{
                  minHeight: TOUCH_TARGET_SIZE,
                  color: selectedIds.size > 0 ? '#f5d0fe' : 'rgba(255,255,255,0.45)',
                  borderColor: selectedIds.size > 0 ? 'rgba(217,70,239,0.5)' : 'rgba(255,255,255,0.2)',
                }}
              >
                Bulk-flytt ({selectedIds.size})
              </Button>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', lg: 'repeat(6,minmax(0,1fr))' },
                gap: 1.5,
              }}
            >
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(17,24,39,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Readiness</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem' }}>{proKpis.avgReadiness}/100</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(17,24,39,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Dekning</Typography>
                <Typography sx={{ color: '#22d3ee', fontWeight: 700, fontSize: '1.2rem' }}>{proKpis.coveragePercent}%</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(17,24,39,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Planlagt tid</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem' }}>{Math.round(proKpis.totalPlanned / 60)}t</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(17,24,39,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Faktisk tid</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem' }}>{Math.round(proKpis.totalActual / 60)}t</Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(17,24,39,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Overtid</Typography>
                <Typography sx={{ color: proKpis.overtime > 0 ? '#fb7185' : '#4ade80', fontWeight: 700, fontSize: '1.2rem' }}>
                  {Math.round(proKpis.overtime / 60)}t
                </Typography>
              </Box>
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(17,24,39,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Forsinkede dager</Typography>
                <Typography sx={{ color: proKpis.delayedCount > 0 ? '#fb7185' : '#4ade80', fontWeight: 700, fontSize: '1.2rem' }}>
                  {proKpis.delayedCount}
                </Typography>
              </Box>
            </Box>

            {selectedProDay && selectedReadiness && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(2,6,23,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
                  <Chip
                    icon={
                      selectedReadiness.level === 'klar' ? <ReadyIcon /> : selectedReadiness.level === 'risiko' ? <RiskIcon /> : <BlockedIcon />
                    }
                    label={`Readiness: ${getReadinessLabel(selectedReadiness.level)} (${selectedReadiness.score})`}
                    sx={{
                      bgcolor: `${getReadinessColor(selectedReadiness.level)}25`,
                      color: '#fff',
                      border: `1px solid ${getReadinessColor(selectedReadiness.level)}66`,
                    }}
                  />
                  <Chip
                    icon={<WarningIcon />}
                    label={`Konflikter: ${selectedConflictSummary?.total || 0}`}
                    sx={{
                      bgcolor: (selectedConflictSummary?.total || 0) > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                      color: '#fff',
                      border: `1px solid ${(selectedConflictSummary?.total || 0) > 0 ? 'rgba(239,68,68,0.55)' : 'rgba(16,185,129,0.55)'}`,
                    }}
                  />
                  <Chip
                    icon={<RiskIcon />}
                    label={`Risikoflagg: ${selectedRisks.length}`}
                    sx={{
                      bgcolor: selectedRisks.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)',
                      color: '#fff',
                      border: `1px solid ${selectedRisks.length > 0 ? 'rgba(245,158,11,0.55)' : 'rgba(16,185,129,0.55)'}`,
                    }}
                  />
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={selectedReadiness.score}
                  sx={{
                    height: 9,
                    borderRadius: 999,
                    bgcolor: 'rgba(255,255,255,0.15)',
                    '& .MuiLinearProgress-bar': { bgcolor: getReadinessColor(selectedReadiness.level) },
                  }}
                />

                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        size="small"
                        checked={!!proMetaByDay[selectedProDay.id]?.permitsReady}
                        onChange={(event) =>
                          updateDayMeta(selectedProDay.id, (previous) => ({
                            ...previous,
                            permitsReady: event.target.checked,
                          }))
                        }
                      />
                    }
                    label={<Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem' }}>Tillatelser klar</Typography>}
                  />
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        size="small"
                        checked={!!proMetaByDay[selectedProDay.id]?.transportReady}
                        onChange={(event) =>
                          updateDayMeta(selectedProDay.id, (previous) => ({
                            ...previous,
                            transportReady: event.target.checked,
                          }))
                        }
                      />
                    }
                    label={<Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem' }}>Transport klar</Typography>}
                  />
                </Box>

                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {selectedReadiness.reasons.slice(0, 4).map((reason) => (
                    <Chip key={reason} label={reason} size="small" sx={{ bgcolor: 'rgba(148,163,184,0.2)', color: '#e2e8f0' }} />
                  ))}
                </Box>

                <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.25 }}>
                  <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ color: '#c4b5fd', fontWeight: 600, fontSize: '0.82rem', mb: 0.75 }}>
                      Avhengigheter
                    </Typography>
                    <FormControl size="small" fullWidth sx={{ mb: 0.75 }}>
                      <Select
                        multiple
                        value={proMetaByDay[selectedProDay.id]?.dependencies || []}
                        onChange={(event) =>
                          updateDayMeta(selectedProDay.id, (previous) => ({
                            ...previous,
                            dependencies: typeof event.target.value === 'string'
                              ? event.target.value.split(',')
                              : (event.target.value as string[]),
                          }))
                        }
                        renderValue={(selected) => {
                          const ids = selected as string[];
                          if (ids.length === 0) return 'Velg avhengige dager';
                          return `${ids.length} valgt`;
                        }}
                        sx={{
                          color: '#fff',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                        }}
                      >
                        {productionDays
                          .filter((candidate) => candidate.id !== selectedProDay.id)
                          .map((candidate) => (
                            <MenuItem key={`dep-${candidate.id}`} value={candidate.id}>
                              {new Date(candidate.date).toLocaleDateString('nb-NO')} · {getLocationName(candidate.locationId)}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                    {selectedDependencies.length === 0 ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
                        Ingen blokkerende avhengigheter funnet.
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {selectedDependencies.map((dependency) => (
                          <Typography key={dependency} sx={{ color: '#f8fafc', fontSize: '0.82rem' }}>
                            • {dependency}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.82rem', mb: 0.75 }}>
                      Risikopanel
                    </Typography>
                    {selectedRisks.length === 0 ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
                        Ingen kritiske risikoer registrert.
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {selectedRisks.map((risk) => (
                          <Typography key={risk} sx={{ color: '#f8fafc', fontSize: '0.82rem' }}>
                            • {risk}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            {selectedProDay && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(2,6,23,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Typography sx={{ color: '#67e8f9', fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
                  Feltmodus og teamflyt
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<StartIcon />}
                    onClick={() => void applyFieldStatus(selectedProDay, 'in_progress', 'check_in')}
                    sx={{ color: '#22d3ee', borderColor: 'rgba(34,211,238,0.45)' }}
                  >
                    Check-in
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<StopIcon />}
                    onClick={() => void applyFieldStatus(selectedProDay, 'completed', 'check_out')}
                    sx={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.45)' }}
                  >
                    Check-out
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<QueueIcon />}
                    onClick={() => void applyFieldStatus(selectedProDay, selectedProDay.status, 'status_update')}
                    sx={{ color: '#e9d5ff', borderColor: 'rgba(217,70,239,0.45)' }}
                  >
                    Synk status
                  </Button>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,minmax(0,1fr))' }, gap: 1, mb: 1.25 }}>
                  <TextField
                    size="small"
                    type="number"
                    label="Estimert min"
                    value={proMetaByDay[selectedProDay.id]?.estimatedMinutes ?? plannedMinutesForDay(selectedProDay)}
                    onChange={(event) =>
                      updateDayMeta(selectedProDay.id, (previous) => ({
                        ...previous,
                        estimatedMinutes: Number(event.target.value) || 0,
                      }))
                    }
                    sx={{
                      '& .MuiInputBase-root': { color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Faktisk min"
                    value={proMetaByDay[selectedProDay.id]?.actualMinutes ?? ''}
                    onChange={(event) =>
                      updateDayMeta(selectedProDay.id, (previous) => ({
                        ...previous,
                        actualMinutes: Number(event.target.value) || 0,
                      }))
                    }
                    sx={{
                      '& .MuiInputBase-root': { color: '#fff' },
                      '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    }}
                  />
                  <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>Check-in</Typography>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 600 }}>
                      {proMetaByDay[selectedProDay.id]?.checkInAt
                        ? new Date(proMetaByDay[selectedProDay.id]!.checkInAt!).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                        : 'Ikke satt'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>Check-out</Typography>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 600 }}>
                      {proMetaByDay[selectedProDay.id]?.checkOutAt
                        ? new Date(proMetaByDay[selectedProDay.id]!.checkOutAt!).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
                        : 'Ikke satt'}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 1.25 }}>
                  <Box>
                    <TextField
                      multiline
                      minRows={3}
                      fullWidth
                      value={selectedDraft}
                      onChange={(event) =>
                        setTeamFlowDraftByDay((prev) => ({
                          ...prev,
                          [selectedProDay.id]: event.target.value,
                        }))
                      }
                      placeholder="Skriv vurdering eller beslutning. Bruk @navn for tagging."
                      sx={{
                        '& .MuiInputBase-root': {
                          color: '#fff',
                          bgcolor: 'rgba(15,23,42,0.55)',
                        },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                      }}
                    />
                    <GlobalMentionHelper
                      text={selectedDraft}
                      localCandidates={mentionDirectory}
                      onApplySuggestion={(name) => applyDraftSuggestion(selectedProDay.id, name)}
                    />
                    {selectedMentionSuggestions.length > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {selectedMentionSuggestions.map((name) => (
                          <Chip
                            key={name}
                            icon={<CommentIcon />}
                            label={`@${name}`}
                            onClick={() => replaceDraftMention(selectedProDay.id, selectedMentionQuery, name)}
                            sx={{ bgcolor: 'rgba(6,182,212,0.2)', color: '#cffafe' }}
                          />
                        ))}
                      </Box>
                    )}
                    {selectedDidYouMean?.suggestion && (
                      <Alert
                        severity="info"
                        sx={{ mt: 1, bgcolor: 'rgba(14,116,144,0.2)', color: '#e0f2fe', '& .MuiAlert-icon': { color: '#67e8f9' } }}
                        action={
                          <Button
                            size="small"
                            onClick={() => replaceDraftMention(selectedProDay.id, selectedDidYouMean.rawTag, selectedDidYouMean.suggestion!)}
                            sx={{ color: '#67e8f9' }}
                          >
                            Bytt
                          </Button>
                        }
                      >
                        Mener du @{selectedDidYouMean.suggestion}?
                      </Alert>
                    )}
                    {selectedDraftMentions.length > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {selectedDraftMentions.map((tag) => (
                          <Chip
                            key={tag}
                            label={`Tag: ${tag}`}
                            onDelete={() => replaceDraftMention(selectedProDay.id, tag, '')}
                            sx={{ bgcolor: 'rgba(124,58,237,0.25)', color: '#f5d0fe' }}
                          />
                        ))}
                      </Box>
                    )}
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CommentIcon />}
                        onClick={() => addTeamFlowEntry(selectedProDay.id, 'comment')}
                        sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
                      >
                        Legg til kommentar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<HistoryIcon />}
                        onClick={() => addTeamFlowEntry(selectedProDay.id, 'decision')}
                        sx={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.45)' }}
                      >
                        Logg beslutning
                      </Button>
                    </Box>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 220, overflowY: 'auto' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem', mb: 0.75 }}>
                      Teamlogg
                    </Typography>
                    {selectedTeamFlow.length === 0 ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem' }}>
                        Ingen registrerte kommentarer eller beslutninger.
                      </Typography>
                    ) : (
                      <Stack spacing={0.75}>
                        {[...selectedTeamFlow].reverse().slice(0, 8).map((entry) => (
                          <Box key={entry.id} sx={{ p: 0.75, borderRadius: 1.25, bgcolor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(148,163,184,0.2)' }}>
                            <Typography sx={{ color: entry.type === 'decision' ? '#fbbf24' : '#67e8f9', fontSize: '0.72rem', fontWeight: 700 }}>
                              {entry.type === 'decision' ? 'Beslutning' : 'Kommentar'} · {entry.author}
                            </Typography>
                            <Typography sx={{ color: '#f8fafc', fontSize: '0.8rem' }}>{entry.text}</Typography>
                            {!!entry.mentions.length && (
                              <Typography sx={{ color: '#d8b4fe', fontSize: '0.72rem', mt: 0.25 }}>
                                Tags: {entry.mentions.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* Results count */}
      {(searchQuery || statusFilter !== 'all') && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(156,39,176,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#9c27b0' },
          }}
        >
          Viser {filteredAndSortedDays.length} av {productionDays.length} produksjonsdager
        </Alert>
      )}

      {/* Empty state */}
      {productionDays.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={calenderPng}
          title="Ingen produksjonsdager ennå"
          subtitle="Legg til produksjonsdager for å planlegge dag-for-dag produksjon"
          color="#9c27b0"
        />
      ) : filteredAndSortedDays.length === 0 ? (
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
          <Table aria-label="Produksjonsdager tabell" sx={{ minWidth: { xs: 600, sm: 'auto' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedDays.length && filteredAndSortedDays.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedDays.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle produksjonsdager"
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#9c27b0' } }}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'date'}
                    direction={sortField === 'date' ? sortDirection : 'asc'}
                    onClick={() => handleSort('date')}
                    sx={{ color: '#fff', '&:hover': { color: '#9c27b0' } }}
                  >
                    Dato
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'location'}
                    direction={sortField === 'location' ? sortDirection : 'asc'}
                    onClick={() => handleSort('location')}
                    sx={{ color: '#fff', '&:hover': { color: '#9c27b0' } }}
                  >
                    Lokasjon
                  </TableSortLabel>
                </TableCell>
                <TableCell>Tid</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', '&:hover': { color: '#9c27b0' } }}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'scenes'}
                    direction={sortField === 'scenes' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scenes')}
                    sx={{ color: '#fff', '&:hover': { color: '#9c27b0' } }}
                  >
                    Scener
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedDays.map((day) => (
                <TableRow
                  key={day.id}
                  sx={{
                    bgcolor: selectedIds.has(day.id) ? 'rgba(156,39,176,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(day.id)}
                      onChange={() => handleToggleSelect(day.id)}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#9c27b0' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {favorites.has(day.id) && <StarIcon sx={{ color: '#ffc107', fontSize: 16 }} />}
                      <Typography sx={{ color: '#fff' }}>
                        {new Date(day.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>{getLocationName(day.locationId)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {day.callTime} - {day.wrapTime}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(day.status)}
                      size="small"
                      sx={{ bgcolor: getStatusColor(day.status), color: '#000', fontWeight: 600, fontSize: '10px' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip label={day.scenes.length} size="small" sx={{ bgcolor: 'rgba(156,39,176,0.2)', color: '#9c27b0' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title={favorites.has(day.id) ? 'Fjern favoritt' : 'Favoritt'}>
                        <IconButton onClick={() => toggleFavorite(day.id)} sx={{ color: favorites.has(day.id) ? '#ffc107' : 'rgba(255,255,255,0.3)' }}>
                          {favorites.has(day.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton onClick={() => handleDuplicate(day)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(day);
                          }} 
                          sx={{ color: '#9c27b0' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteWithUndo(day.id)} sx={{ color: '#ff4444' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Grid View - Grouped by month */
        <Box>
          {Object.entries(groupedDays).map(([month, days]) => (
            <Box key={month} sx={{ mb: { xs: 3, sm: 4, md: 5 } }}>
              <Typography 
                variant="h6" 
                component="h3" 
                sx={{ 
                  color: '#fff', 
                  mb: { xs: 2, sm: 2.5 }, 
                  fontWeight: 600,
                  fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem' },
                }}
              >
                {month}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: { xs: 2, sm: 2.5, md: 3, lg: 3.5 },
                  alignItems: 'stretch',
                }}
              >
                {days.map((day) => {
                  // Use cached data from async loading
                  const cachedData = dayDataCache[day.id] || { scenes: [], crew: [], props: [], validation: { valid: true, errors: [], warnings: [] } };
                  const dayScenes = cachedData.scenes;
                  const dayCrew = cachedData.crew;
                  const dayProps = cachedData.props;
                  const validation = cachedData.validation;
                  const dayReadiness = readinessByDay[day.id] || { level: 'risiko' as ReadinessLevel, score: 0, reasons: [] };
                  const dayConflicts = conflictMap[day.id] || { crew: [], location: [], props: [], time: [], total: 0 };
                  const dayRiskCount = getRiskSignals(day).length;
                  const dependencyIssueCount = getDependencyIssues(day).length;

                  return (
                    <Box key={day.id} sx={{ minWidth: 0, height: '100%' }}>
                      <Card
                        component="article"
                        draggable
                        onDragStart={() => {
                          setDraggingDayId(day.id);
                        }}
                        onDragEnd={() => {
                          setDragTargetDayId(null);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggingDayId && draggingDayId !== day.id) {
                            setDragTargetDayId(day.id);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggingDayId && draggingDayId !== day.id) {
                            setDragTargetDayId(day.id);
                            setShowDragPreviewDialog(true);
                          }
                        }}
                        sx={{
                          bgcolor: selectedIds.has(day.id) ? 'rgba(156,39,176,0.15)' : 'rgba(255,255,255,0.05)',
                          border: selectedIds.has(day.id) ? '2px solid #9c27b0' : '1px solid rgba(255,255,255,0.1)',
                          outline: dragTargetDayId === day.id ? '2px dashed rgba(34,211,238,0.8)' : 'none',
                          borderRadius: 2,
                          transition: 'all 0.2s ease',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          '&:hover': { 
                            bgcolor: 'rgba(255,255,255,0.08)', 
                            borderColor: '#9c27b0',
                            boxShadow: '0 8px 24px rgba(156,39,176,0.2)',
                            transform: 'translateY(-2px)',
                          },
                          ...focusVisibleStyles,
                        }}
                      >
                        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                          {/* Card Header */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 2 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Checkbox
                                checked={selectedIds.has(day.id)}
                                onChange={() => handleToggleSelect(day.id)}
                                sx={{ p: 0.5, color: 'rgba(255,255,255,0.6)', '&.Mui-checked': { color: '#9c27b0' } }}
                              />
                              <Box sx={{ flex: 1 }}>
                                {/* Eye-catching Date Display */}
                                <Box 
                                  sx={{ 
                                    position: 'relative',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 2,
                                    mb: 1.5,
                                    p: { xs: 2, sm: 2.5 },
                                    borderRadius: 3,
                                    background: 'linear-gradient(135deg, rgba(156,39,176,0.25) 0%, rgba(123,31,162,0.15) 100%)',
                                    border: '2px solid rgba(156,39,176,0.4)',
                                    boxShadow: '0 4px 12px rgba(156,39,176,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                                    overflow: 'hidden',
                                    '&::before': {
                                      content: '""',
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      height: '3px',
                                      background: 'linear-gradient(90deg, #9c27b0 0%, #7b1fa2 50%, #9c27b0 100%)',
                                    },
                                  }}
                                >
                                  {/* Large Calendar Icon with Day Number */}
                                  <Box
                                    sx={{
                                      position: 'relative',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minWidth: { xs: 70, sm: 85, md: 95 },
                                      height: { xs: 70, sm: 85, md: 95 },
                                      borderRadius: 3,
                                      background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                                      border: '3px solid rgba(255,255,255,0.3)',
                                      boxShadow: '0 4px 16px rgba(156,39,176,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {/* Decorative circle background */}
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        top: -20,
                                        right: -20,
                                        width: 60,
                                        height: 60,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                      }}
                                    />
                                    <CalendarIcon sx={{ 
                                      fontSize: { xs: 28, sm: 34, md: 38 }, 
                                      color: '#fff', 
                                      mb: 0.5,
                                      zIndex: 1,
                                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                                    }} />
                                    <Typography
                                      variant="h6"
                                      sx={{
                                        color: '#fff',
                                        fontWeight: 800,
                                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                                        lineHeight: 1,
                                        zIndex: 1,
                                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        letterSpacing: '-0.5px',
                                      }}
                                    >
                                      {new Date(day.date).toLocaleDateString('no-NO', { day: 'numeric' })}
                                    </Typography>
                                  </Box>
                                  
                                  {/* Date Text */}
                                  <Box sx={{ flex: 1, zIndex: 1 }}>
                                    <Typography
                                      variant="h5"
                                      component="h4"
                                      sx={{ 
                                        color: '#fff', 
                                        fontWeight: 800, 
                                        fontSize: { xs: '1.125rem', sm: '1.375rem', md: '1.5rem' },
                                        lineHeight: 1.1,
                                        mb: 0.5,
                                        textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                        letterSpacing: '-0.5px',
                                      }}
                                    >
                                      {new Date(day.date).toLocaleDateString('no-NO', { weekday: 'long' })}
                                    </Typography>
                                    <Typography
                                      variant="subtitle1"
                                      sx={{ 
                                        color: 'rgba(255,255,255,0.9)', 
                                        fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem' },
                                        fontWeight: 600,
                                        textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                      }}
                                    >
                                      {new Date(day.date).toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}
                                    </Typography>
                                  </Box>
                                </Box>
                                
                                {/* Status Badge - Enhanced */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: { xs: 1.5, sm: 2 },
                                    py: { xs: 0.75, sm: 1 },
                                    borderRadius: 2,
                                    bgcolor: `${getStatusColor(day.status)}25`,
                                    border: `2px solid ${getStatusColor(day.status)}`,
                                    boxShadow: `0 0 12px ${getStatusColor(day.status)}40`,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: { xs: 10, sm: 12 },
                                      height: { xs: 10, sm: 12 },
                                      borderRadius: '50%',
                                      bgcolor: getStatusColor(day.status),
                                      boxShadow: `0 0 8px ${getStatusColor(day.status)}`,
                                      animation: day.status === 'in_progress' ? 'pulse 2s infinite' : 'none',
                                      '@keyframes pulse': {
                                        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                        '50%': { opacity: 0.6, transform: 'scale(0.85)' },
                                      },
                                    }}
                                  />
                                  <Typography
                                    sx={{
                                      color: getStatusColor(day.status),
                                      fontSize: { xs: '0.875rem', sm: '1rem' },
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px',
                                    }}
                                  >
                                    {getStatusLabel(day.status)}
                                  </Typography>
                                </Box>
                                {proViewEnabled && (
                                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                    <Chip
                                      size="small"
                                      label={`${getReadinessLabel(dayReadiness.level)} ${dayReadiness.score}`}
                                      sx={{
                                        bgcolor: `${getReadinessColor(dayReadiness.level)}28`,
                                        color: '#fff',
                                        border: `1px solid ${getReadinessColor(dayReadiness.level)}66`,
                                        fontWeight: 700,
                                      }}
                                    />
                                    <Chip
                                      size="small"
                                      label={`Konflikt ${dayConflicts.total}`}
                                      sx={{
                                        bgcolor: dayConflicts.total > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.2)',
                                        color: '#fff',
                                        border: `1px solid ${dayConflicts.total > 0 ? 'rgba(239,68,68,0.55)' : 'rgba(16,185,129,0.55)'}`,
                                      }}
                                    />
                                    <Chip
                                      size="small"
                                      label={`Risiko ${dayRiskCount}`}
                                      sx={{
                                        bgcolor: dayRiskCount > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)',
                                        color: '#fff',
                                        border: `1px solid ${dayRiskCount > 0 ? 'rgba(245,158,11,0.55)' : 'rgba(16,185,129,0.55)'}`,
                                      }}
                                    />
                                    <Chip
                                      size="small"
                                      label={`Avheng. ${dependencyIssueCount}`}
                                      sx={{
                                        bgcolor: dependencyIssueCount > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(148,163,184,0.2)',
                                        color: '#fff',
                                        border: `1px solid ${dependencyIssueCount > 0 ? 'rgba(59,130,246,0.55)' : 'rgba(148,163,184,0.45)'}`,
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
                            </Box>
                            <IconButton
                              onClick={() => toggleFavorite(day.id)}
                              aria-label={favorites.has(day.id) ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                              sx={{
                                minWidth: TOUCH_TARGET_SIZE,
                                minHeight: TOUCH_TARGET_SIZE,
                                color: favorites.has(day.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                                '&:hover': { bgcolor: 'rgba(255,193,7,0.1)' },
                                ...focusVisibleStyles,
                              }}
                            >
                              {favorites.has(day.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />}
                            </IconButton>
                          </Box>

                          {/* Last Modified Info - Compact */}
                          {day.lastModifiedBy && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 2,
                                px: 1.5,
                                py: 1,
                                bgcolor: 'rgba(156,39,176,0.08)',
                                borderRadius: 1.5,
                                border: '1px solid rgba(156,39,176,0.15)',
                              }}
                            >
                              <HistoryIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />
                              <Typography
                                sx={{
                                  fontSize: '0.75rem',
                                  color: 'rgba(255,255,255,0.87)',
                                }}
                              >
                                Sist endret av <strong style={{ color: 'rgba(255,255,255,0.87)' }}>{day.lastModifiedBy}</strong>
                                {' • '}
                                {new Date(getDayUpdatedAt(day)).toLocaleDateString('nb-NO', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                                {' '}
                                {new Date(getDayUpdatedAt(day)).toLocaleTimeString('nb-NO', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Typography>
                            </Box>
                          )}

                          {/* Info rows - Enhanced visibility */}
                          <Stack spacing={2} sx={{ mb: { xs: 2, sm: 2.5 } }}>
                            {/* Time Card */}
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: { xs: 1.5, sm: 2 },
                                borderRadius: 2.5,
                                bgcolor: 'rgba(156,39,176,0.12)',
                                border: '1px solid rgba(156,39,176,0.25)',
                              }}
                            >
                              <Box
                                sx={{
                                  width: { xs: 44, sm: 52 },
                                  height: { xs: 44, sm: 52 },
                                  borderRadius: 2,
                                  bgcolor: 'rgba(156,39,176,0.25)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <TimeIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#ce93d8' }} />
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  sx={{
                                    color: 'rgba(255,255,255,0.87)',
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    mb: 0.25,
                                  }}
                                >
                                  Arbeidstid
                                </Typography>
                                <Typography
                                  sx={{
                                    color: '#fff',
                                    fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.375rem' },
                                    fontWeight: 700,
                                    letterSpacing: '-0.5px',
                                  }}
                                >
                                  {day.callTime} – {day.wrapTime}
                                </Typography>
                              </Box>
                              {/* Duration Badge - Enhanced */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  px: { xs: 1.5, sm: 2 },
                                  py: { xs: 1, sm: 1.25 },
                                  borderRadius: 2,
                                  bgcolor: 'rgba(156,39,176,0.35)',
                                  border: '2px solid rgba(206,147,216,0.5)',
                                  minWidth: { xs: 56, sm: 68 },
                                }}
                              >
                                <Typography
                                  sx={{
                                    color: 'rgba(255,255,255,0.87)',
                                    fontSize: { xs: '0.6rem', sm: '0.65rem' },
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    lineHeight: 1,
                                  }}
                                >
                                  Varighet
                                </Typography>
                                <Typography
                                  sx={{
                                    color: '#fff',
                                    fontSize: { xs: '1.25rem', sm: '1.5rem' },
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    mt: 0.25,
                                  }}
                                >
                                  {`${(plannedMinutesForDay(day) / 60).toFixed(1).replace('.0', '')}t`}
                                </Typography>
                              </Box>
                            </Box>

                            {/* Location Card */}
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: { xs: 1.5, sm: 2 },
                                borderRadius: 2.5,
                                bgcolor: 'rgba(76,175,80,0.12)',
                                border: '1px solid rgba(76,175,80,0.25)',
                              }}
                            >
                              <Box
                                sx={{
                                  width: { xs: 44, sm: 52 },
                                  height: { xs: 44, sm: 52 },
                                  borderRadius: 2,
                                  bgcolor: 'rgba(76,175,80,0.25)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <LocationIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#81c784' }} />
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  sx={{
                                    color: 'rgba(255,255,255,0.87)',
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    mb: 0.25,
                                  }}
                                >
                                  Lokasjon
                                </Typography>
                                <Typography
                                  sx={{
                                    color: '#fff',
                                    fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' },
                                    fontWeight: 700,
                                    letterSpacing: '-0.25px',
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {getLocationName(day.locationId)}
                                </Typography>
                              </Box>
                              <Tooltip title="Åpne lokasjon i kart">
                                <IconButton
                                  onClick={() => openLocationInMaps(day.locationId)}
                                  aria-label={`Åpne lokasjon i kart for ${getLocationName(day.locationId)}`}
                                  sx={{
                                    color: '#81c784',
                                    border: '1px solid rgba(129,199,132,0.35)',
                                    bgcolor: 'rgba(76,175,80,0.12)',
                                    ...focusVisibleStyles,
                                  }}
                                >
                                  <OpenInNewIcon sx={{ fontSize: 20 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            
                            {/* Weather Forecast - Clear & Organized */}
                            {(() => {
                              if (!day.weatherForecast || !day.weatherForecast.forecast || day.weatherForecast.forecast.length === 0) {
                                return null;
                              }

                              const dateStr = day.date.split('T')[0];
                              const dayForecast = day.weatherForecast.forecast.find(
                                f => f.date && f.date.startsWith(dateStr)
                              ) || day.weatherForecast.forecast[0];

                              if (!dayForecast) return null;

                              const symbol = dayForecast.symbol || 'clear';
                              const isSunny = symbol.includes('sun') || symbol.includes('clear');
                              const isCloudy = symbol.includes('cloud') && !symbol.includes('rain') && !symbol.includes('snow');
                              const isRainy = symbol.includes('rain');
                              const isSnowy = symbol.includes('snow');
                              const isThunder = symbol.includes('thunder');

                              const getWeatherLabel = () => {
                                if (isSunny) return 'Sol';
                                if (isThunder) return 'Torden';
                                if (isRainy) return 'Regn';
                                if (isSnowy) return 'Snø';
                                if (isCloudy) return 'Overskyet';
                                return 'Varierende';
                              };

                              const getWeatherColor = () => {
                                if (isSunny) return '#ffb800';
                                if (isRainy) return '#00d4ff';
                                if (isSnowy) return '#a8d8ff';
                                if (isThunder) return '#8b5cf6';
                                if (isCloudy) return '#94a3b8';
                                return '#94a3b8';
                              };

                              const getBgGradient = () => {
                                if (isSunny) return 'linear-gradient(135deg, rgba(255,184,0,0.2) 0%, rgba(255,120,0,0.1) 100%)';
                                if (isRainy) return 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,100,180,0.1) 100%)';
                                if (isSnowy) return 'linear-gradient(135deg, rgba(168,216,255,0.2) 0%, rgba(200,230,255,0.1) 100%)';
                                if (isThunder) return 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(80,40,180,0.1) 100%)';
                                return 'linear-gradient(135deg, rgba(148,163,184,0.15) 0%, rgba(100,116,139,0.1) 100%)';
                              };

                              return (
                                <Box
                                  sx={{
                                    position: 'relative',
                                    p: { xs: 2, sm: 2.5 },
                                    borderRadius: 3,
                                    background: getBgGradient(),
                                    border: `2px solid ${getWeatherColor()}40`,
                                    boxShadow: `0 4px 20px ${getWeatherColor()}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
                                    overflow: 'hidden',
                                    '@keyframes spin': {
                                      '0%': { transform: 'rotate(0deg)' },
                                      '100%': { transform: 'rotate(360deg)' },
                                    },
                                    '@keyframes pulse': {
                                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                      '50%': { opacity: 0.8, transform: 'scale(1.05)' },
                                    },
                                    '@keyframes float': {
                                      '0%, 100%': { transform: 'translateX(0)' },
                                      '50%': { transform: 'translateX(4px)' },
                                    },
                                    '@keyframes rain': {
                                      '0%': { transform: 'translateY(-8px)', opacity: 0 },
                                      '30%': { opacity: 1 },
                                      '100%': { transform: 'translateY(12px)', opacity: 0 },
                                    },
                                    '@keyframes snow': {
                                      '0%': { transform: 'translateY(-6px) rotate(0deg)', opacity: 0 },
                                      '30%': { opacity: 1 },
                                      '100%': { transform: 'translateY(10px) rotate(180deg)', opacity: 0 },
                                    },
                                    '@keyframes flash': {
                                      '0%, 85%, 100%': { opacity: 1 },
                                      '90%': { opacity: 0.2 },
                                    },
                                  }}
                                >
                                  {/* Header with label */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'rgba(255,255,255,0.87)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      Værmelding
                                    </Typography>
                                    <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
                                  </Box>

                                  {/* Main weather display */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 } }}>
                                    {/* Large animated icon */}
                                    <Box
                                      sx={{
                                        position: 'relative',
                                        width: { xs: 60, sm: 70 },
                                        height: { xs: 60, sm: 70 },
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '50%',
                                        bgcolor: `${getWeatherColor()}15`,
                                        border: `1px solid ${getWeatherColor()}30`,
                                      }}
                                    >
                                      {isSunny && (
                                        <SunIcon sx={{
                                          color: '#ffb800',
                                          fontSize: { xs: 38, sm: 44 },
                                          animation: 'spin 25s linear infinite',
                                          filter: 'drop-shadow(0 0 12px rgba(255,184,0,0.6))',
                                        }} />
                                      )}
                                      {isCloudy && (
                                        <CloudIcon sx={{
                                          color: '#94a3b8',
                                          fontSize: { xs: 38, sm: 44 },
                                          animation: 'float 4s ease-in-out infinite',
                                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                                        }} />
                                      )}
                                      {isRainy && (
                                        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <CloudIcon sx={{
                                            color: '#64b5f6',
                                            fontSize: { xs: 34, sm: 40 },
                                            animation: 'float 3s ease-in-out infinite',
                                          }} />
                                          {[0, 1, 2, 3].map((i) => (
                                            <Box
                                              key={i}
                                              sx={{
                                                position: 'absolute',
                                                bottom: { xs: -2, sm: 0 },
                                                left: { xs: 8 + i * 10, sm: 10 + i * 11 },
                                                width: 3,
                                                height: 10,
                                                bgcolor: '#00d4ff',
                                                borderRadius: 2,
                                                animation: 'rain 0.7s ease-in-out infinite',
                                                animationDelay: `${i * 0.15}s`,
                                              }}
                                            />
                                          ))}
                                        </Box>
                                      )}
                                      {isSnowy && (
                                        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <CloudIcon sx={{
                                            color: '#b0c4de',
                                            fontSize: { xs: 34, sm: 40 },
                                            animation: 'float 4s ease-in-out infinite',
                                          }} />
                                          {[0, 1, 2].map((i) => (
                                            <SnowIcon
                                              key={i}
                                              sx={{
                                                position: 'absolute',
                                                bottom: { xs: -4, sm: -2 },
                                                left: { xs: 10 + i * 12, sm: 14 + i * 13 },
                                                fontSize: { xs: 12, sm: 14 },
                                                color: '#fff',
                                                animation: 'snow 1.8s ease-in-out infinite',
                                                animationDelay: `${i * 0.5}s`,
                                              }}
                                            />
                                          ))}
                                        </Box>
                                      )}
                                      {isThunder && (
                                        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <CloudIcon sx={{
                                            color: '#5c6370',
                                            fontSize: { xs: 34, sm: 40 },
                                          }} />
                                          <ThunderIcon sx={{
                                            position: 'absolute',
                                            bottom: { xs: -6, sm: -4 },
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            color: '#ffd700',
                                            fontSize: { xs: 22, sm: 26 },
                                            animation: 'flash 1.5s ease-in-out infinite',
                                            filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.9))',
                                          }} />
                                        </Box>
                                      )}
                                    </Box>

                                    {/* Temperature and details */}
                                    <Box sx={{ flex: 1 }}>
                                      {/* Weather type label */}
                                      <Typography
                                        sx={{
                                          color: getWeatherColor(),
                                          fontWeight: 700,
                                          fontSize: { xs: '0.875rem', sm: '1rem' },
                                          mb: 0.5,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px',
                                        }}
                                      >
                                        {getWeatherLabel()}
                                      </Typography>

                                      {/* Temperature - Large and prominent */}
                                      <Typography
                                        variant="h3"
                                        sx={{
                                          color: '#fff',
                                          fontWeight: 800,
                                          fontSize: { xs: '2.25rem', sm: '2.75rem' },
                                          lineHeight: 1,
                                          mb: 1,
                                          textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                        }}
                                      >
                                        {dayForecast.temperature !== undefined ? Math.round(dayForecast.temperature) : '--'}°
                                      </Typography>

                                      {/* Weather details in a grid */}
                                      <Box sx={{ display: 'flex', gap: { xs: 2, sm: 3 }, flexWrap: 'wrap' }}>
                                        {dayForecast.precipitation !== undefined && (
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <UmbrellaIcon sx={{
                                              fontSize: { xs: 18, sm: 20 },
                                              color: '#00d4ff',
                                              animation: dayForecast.precipitation > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
                                            }} />
                                            <Box>
                                              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1 }}>
                                                {Math.round(dayForecast.precipitation)} mm
                                              </Typography>
                                              <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                Nedbør
                                              </Typography>
                                            </Box>
                                          </Box>
                                        )}
                                        {dayForecast.windSpeed !== undefined && (
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <WindIcon sx={{
                                              fontSize: { xs: 18, sm: 20 },
                                              color: '#94a3b8',
                                              animation: dayForecast.windSpeed > 5 ? 'pulse 1.5s ease-in-out infinite' : 'none',
                                            }} />
                                            <Box>
                                              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1 }}>
                                                {Math.round(dayForecast.windSpeed)} m/s
                                              </Typography>
                                              <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                Vind
                                              </Typography>
                                            </Box>
                                          </Box>
                                        )}
                                        {dayForecast.humidity !== undefined && (
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                            <Box sx={{
                                              width: { xs: 18, sm: 20 },
                                              height: { xs: 18, sm: 20 },
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#64b5f6',
                                              fontSize: { xs: '0.75rem', sm: '0.8rem' },
                                              fontWeight: 700,
                                            }}>
                                              💧
                                            </Box>
                                            <Box>
                                              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1 }}>
                                                {Math.round(dayForecast.humidity)}%
                                              </Typography>
                                              <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                Fuktighet
                                              </Typography>
                                            </Box>
                                          </Box>
                                        )}
                                      </Box>
                                    </Box>
                                  </Box>
                                </Box>
                              );
                            })()}

                            {expandedCards.has(day.id) && day.weatherForecast && (
                              <WeatherForecastCard
                                forecast={day.weatherForecast}
                                date={day.date}
                              />
                            )}
                          </Stack>

                          {/* Expandable details - Improved Layout for iPad Landscape */}
                          <Collapse in={expandedCards.has(day.id)}>
                            <Box
                              sx={{
                                mt: 2.5,
                                pt: 2.5,
                                borderTop: '2px solid rgba(156,39,176,0.3)',
                                // iPad landscape optimizations
                                '@media (min-width: 1024px) and (max-width: 1366px) and (orientation: landscape)': {
                                  display: 'grid',
                                  gridTemplateColumns: '1fr',
                                  gap: 2,
                                },
                              }}
                            >
                              {/* Section Header */}
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  color: '#9c27b0',
                                  fontWeight: 700,
                                  fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem' },
                                  mb: 2.5,
                                  textTransform: 'uppercase',
                                  letterSpacing: '1px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  '@media (min-width: 1024px) and (orientation: landscape)': {
                                    fontSize: '1.125rem',
                                  },
                                }}
                              >
                                📋 Produksjonsdetaljer
                              </Typography>

                              {/* Grid layout for sections - Optimized for iPad Landscape */}
                              <Grid
                                container
                                spacing={{ xs: 2, sm: 2, md: 2.5 }}
                                sx={{
                                  // iPad landscape: show 2x2 grid
                                  '@media (min-width: 768px) and (orientation: landscape)': {
                                    '& > .MuiGrid-item': {
                                      flexBasis: '50%',
                                      maxWidth: '50%',
                                    },
                                  },
                                  // Larger iPads and tablets in landscape
                                  '@media (min-width: 1024px) and (orientation: landscape)': {
                                    '& > .MuiGrid-item': {
                                      flexBasis: '50%',
                                      maxWidth: '50%',
                                    },
                                  },
                                }}
                              >
                                {/* Scenes Section */}
                                {dayScenes.length > 0 && (
                                  <Grid item xs={12} sm={isLandscape ? 6 : 12} md={6}>
                                    <Box
                                      sx={{
                                        p: { xs: 2, sm: 2.5 },
                                        borderRadius: 2.5,
                                        bgcolor: 'rgba(156,39,176,0.08)',
                                        border: '1px solid rgba(156,39,176,0.2)',
                                        height: '100%',
                                        transition: 'all 0.2s ease',
                                        '@media (min-width: 768px) and (orientation: landscape)': {
                                          p: 2.5,
                                        },
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        <Box
                                          sx={{
                                            width: { xs: 36, sm: 40 },
                                            height: { xs: 36, sm: 40 },
                                            borderRadius: 2,
                                            bgcolor: 'rgba(156,39,176,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          {dayScenes.some((scene) => typeof scene.thumbnail === 'string' && scene.thumbnail.trim().length > 0) ? (
                                            <ImageIcon sx={{ fontSize: { xs: 20, sm: 22 }, color: '#ce93d8' }} />
                                          ) : (
                                            <MovieIcon sx={{ fontSize: { xs: 20, sm: 22 }, color: '#ce93d8' }} />
                                          )}
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                          <Typography sx={{ color: '#ce93d8', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                            Scener
                                          </Typography>
                                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.8rem' } }}>
                                            {dayScenes.length} {dayScenes.length === 1 ? 'scene' : 'scener'} planlagt
                                          </Typography>
                                        </Box>
                                        <Chip
                                          label={dayScenes.length}
                                          size="small"
                                          sx={{
                                            bgcolor: 'rgba(156,39,176,0.3)',
                                            color: '#ce93d8',
                                            fontWeight: 700,
                                            minWidth: 32,
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {dayScenes.map((scene) => (
                                          <Chip
                                            key={scene.id}
                                            label={scene.name}
                                            size="medium"
                                            onClick={() => setScenePreview({
                                              id: scene.id,
                                              name: scene.name,
                                              thumbnail: scene.thumbnail,
                                            })}
                                            sx={{
                                              bgcolor: 'rgba(156,39,176,0.25)',
                                              color: '#e1bee7',
                                              fontWeight: 600,
                                              fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                              height: { xs: 28, sm: 32 },
                                              cursor: 'pointer',
                                              transition: 'all 0.2s',
                                              '&:hover': {
                                                bgcolor: 'rgba(156,39,176,0.45)',
                                                transform: 'translateY(-2px)',
                                                boxShadow: '0 4px 12px rgba(156,39,176,0.3)',
                                              },
                                            }}
                                          />
                                        ))}
                                      </Box>
                                    </Box>
                                  </Grid>
                                )}

                                {/* Team Section */}
                                {dayCrew.length > 0 && (
                                  <Grid item xs={12} sm={isLandscape ? 6 : 12} md={6}>
                                    <Box
                                      sx={{
                                        p: { xs: 2, sm: 2.5 },
                                        borderRadius: 2.5,
                                        bgcolor: 'rgba(0,212,255,0.08)',
                                        border: '1px solid rgba(0,212,255,0.2)',
                                        height: '100%',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        <Box
                                          sx={{
                                            width: { xs: 36, sm: 40 },
                                            height: { xs: 36, sm: 40 },
                                            borderRadius: 2,
                                            bgcolor: 'rgba(0,212,255,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          <PeopleIcon sx={{ fontSize: { xs: 20, sm: 22 }, color: '#00d4ff' }} />
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                          <Typography sx={{ color: '#00d4ff', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                            Team
                                          </Typography>
                                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.8rem' } }}>
                                            {dayCrew.length} {dayCrew.length === 1 ? 'person' : 'personer'} tildelt
                                          </Typography>
                                        </Box>
                                        <Chip
                                          label={dayCrew.length}
                                          size="small"
                                          sx={{
                                            bgcolor: 'rgba(0,212,255,0.3)',
                                            color: '#00d4ff',
                                            fontWeight: 700,
                                            minWidth: 32,
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {dayCrew.map((c) => (
                                          <Chip
                                            key={c.id}
                                            label={`${c.name}${c.role ? ` • ${c.role}` : ''}`}
                                            size="medium"
                                            sx={{
                                              bgcolor: 'rgba(0,212,255,0.2)',
                                              color: '#80deea',
                                              fontWeight: 500,
                                              fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                              height: { xs: 28, sm: 32 },
                                            }}
                                          />
                                        ))}
                                      </Box>
                                    </Box>
                                  </Grid>
                                )}

                                {/* Utstyr Section */}
                                {dayProps.length > 0 && (
                                  <Grid item xs={12} sm={isLandscape ? 6 : 12} md={6}>
                                    <Box
                                      sx={{
                                        p: { xs: 2, sm: 2.5 },
                                        borderRadius: 2.5,
                                        bgcolor: 'rgba(147,51,234,0.08)',
                                        border: '1px solid rgba(147,51,234,0.2)',
                                        height: '100%',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                        <Box
                                          sx={{
                                            width: { xs: 36, sm: 40 },
                                            height: { xs: 36, sm: 40 },
                                            borderRadius: 2,
                                            bgcolor: 'rgba(147,51,234,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          <InventoryIcon sx={{ fontSize: { xs: 20, sm: 22 }, color: '#c084fc' }} />
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                          <Typography sx={{ color: '#c084fc', fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                            Utstyr
                                          </Typography>
                                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.75rem', sm: '0.8rem' } }}>
                                            {dayProps.length} {dayProps.length === 1 ? 'gjenstand' : 'gjenstander'}
                                          </Typography>
                                        </Box>
                                        <Chip
                                          label={dayProps.length}
                                          size="small"
                                          sx={{
                                            bgcolor: 'rgba(147,51,234,0.3)',
                                            color: '#c084fc',
                                            fontWeight: 700,
                                            minWidth: 32,
                                          }}
                                        />
                                      </Box>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {dayProps.map((prop) => (
                                          <Chip
                                            key={prop.id}
                                            label={prop.name}
                                            size="medium"
                                            sx={{
                                              bgcolor: 'rgba(147,51,234,0.2)',
                                              color: '#ffcc80',
                                              fontWeight: 500,
                                              fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                              height: { xs: 28, sm: 32 },
                                            }}
                                          />
                                        ))}
                                      </Box>
                                    </Box>
                                  </Grid>
                                )}

                                {/* Notes Section - Enhanced with Animated Icon */}
                                {day.notes && (
                                  <Grid item xs={12}>
                                    <Box
                                      sx={{
                                        p: { xs: 2.5, sm: 3 },
                                        borderRadius: 3,
                                        bgcolor: 'rgba(255,193,7,0.08)',
                                        border: '2px solid rgba(255,193,7,0.3)',
                                        boxShadow: '0 4px 20px rgba(255,193,7,0.1)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        '&::before': {
                                          content: '""',
                                          position: 'absolute',
                                          top: 0,
                                          left: 0,
                                          width: '6px',
                                          height: '100%',
                                          bgcolor: '#ffc107',
                                          borderRadius: '3px 0 0 3px',
                                        },
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, pl: 1 }}>
                                        <Box
                                          sx={{
                                            width: { xs: 44, sm: 52 },
                                            height: { xs: 44, sm: 52 },
                                            borderRadius: 2.5,
                                            bgcolor: 'rgba(255,193,7,0.2)',
                                            border: '2px solid rgba(255,193,7,0.4)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            '@keyframes writing': {
                                              '0%, 100%': {
                                                transform: 'rotate(-5deg) translateY(0px)',
                                              },
                                              '25%': {
                                                transform: 'rotate(0deg) translateY(-2px)',
                                              },
                                              '50%': {
                                                transform: 'rotate(5deg) translateY(0px)',
                                              },
                                              '75%': {
                                                transform: 'rotate(0deg) translateY(2px)',
                                              },
                                            },
                                          }}
                                        >
                                          <NotesIcon
                                            sx={{
                                              fontSize: { xs: 26, sm: 30 },
                                              color: '#ffc107',
                                              animation: 'writing 2.5s ease-in-out infinite',
                                              filter: 'drop-shadow(0 2px 4px rgba(255,193,7,0.3))',
                                            }}
                                          />
                                        </Box>
                                        <Box>
                                          <Typography
                                            sx={{
                                              color: '#ffc107',
                                              fontWeight: 800,
                                              fontSize: { xs: '1.125rem', sm: '1.25rem' },
                                              letterSpacing: '-0.25px',
                                            }}
                                          >
                                            Notater
                                          </Typography>
                                          <Typography
                                            sx={{
                                              color: 'rgba(255,255,255,0.87)',
                                              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                                            }}
                                          >
                                            Viktig informasjon for produksjonsdagen
                                          </Typography>
                                        </Box>
                                      </Box>
                                      {/* Formatted Notes Content */}
                                      <Box
                                        sx={{
                                          pl: 1,
                                          py: 2,
                                          px: 2,
                                          bgcolor: 'rgba(0,0,0,0.2)',
                                          borderRadius: 2,
                                          border: '1px solid rgba(255,255,255,0.1)',
                                          fontSize: { xs: '0.9375rem', sm: '1rem', md: '1.0625rem' },
                                        }}
                                      >
                                        {renderFormattedNotes(day.notes ?? '')}
                                      </Box>
                                    </Box>
                                  </Grid>
                                )}
                              </Grid>

                              {/* Warnings */}
                              {validation.warnings.length > 0 && (
                                <Alert
                                  severity="warning"
                                  sx={{
                                    mt: 2,
                                    borderRadius: 2,
                                    bgcolor: 'rgba(147,51,234,0.1)',
                                    border: '1px solid rgba(147,51,234,0.3)',
                                    '& .MuiAlert-icon': { color: '#c084fc' },
                                    '& .MuiAlert-message': {
                                      color: 'rgba(255,255,255,0.9)',
                                      fontSize: '0.875rem',
                                    },
                                  }}
                                >
                                  <Typography sx={{ fontWeight: 600, mb: 0.5 }}>⚠️ Advarsel</Typography>
                                  {validation.warnings[0]}
                                </Alert>
                              )}

                              {/* Travel Costs Card */}
                              <Box sx={{ mt: 2.5 }}>
                                <TravelCostsCard productionDay={day} projectId={projectId} />
                              </Box>

                              {/* Change Log / Audit Trail */}
                              {(day.lastModifiedBy || getDayChangeLog(day).length > 0) && (
                                <Box
                                  sx={{
                                    mt: 2.5,
                                    p: 2,
                                    bgcolor: 'rgba(156,39,176,0.05)',
                                    borderRadius: 2,
                                    border: '1px solid rgba(156,39,176,0.2)',
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    sx={{
                                      color: '#9c27b0',
                                      fontWeight: 700,
                                      fontSize: '0.875rem',
                                      mb: 1.5,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <HistoryIcon sx={{ fontSize: 18 }} />
                                    Endringslogg
                                  </Typography>

                                  {/* Last Modified Info */}
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                      mb: 1.5,
                                      p: 1.5,
                                      bgcolor: 'rgba(255,255,255,0.05)',
                                      borderRadius: 1.5,
                                    }}
                                  >
                                    <PersonIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                                    <Box>
                                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.87)' }}>
                                        Sist endret av
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600 }}>
                                        {day.lastModifiedBy || day.createdBy || 'Ukjent'}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.87)' }}>
                                        {new Date(getDayUpdatedAt(day)).toLocaleDateString('nb-NO', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </Typography>
                                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                                        {new Date(getDayUpdatedAt(day)).toLocaleTimeString('nb-NO', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </Typography>
                                    </Box>
                                  </Box>

                                  {/* Recent Changes */}
                                  {getDayChangeLog(day).length > 0 && (
                                    <Box sx={{ maxHeight: 150, overflowY: 'auto' }}>
                                      {getDayChangeLog(day).slice(-5).reverse().map((log, idx) => (
                                        <Box
                                          key={idx}
                                          sx={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 1.5,
                                            py: 1,
                                            borderBottom:
                                              idx < Math.min(getDayChangeLog(day).length - 1, 4)
                                                ? '1px solid rgba(255,255,255,0.05)'
                                                : 'none',
                                          }}
                                        >
                                          <Box
                                            sx={{
                                              width: 8,
                                              height: 8,
                                              borderRadius: '50%',
                                              bgcolor: log.action === 'created' ? '#10b981' : log.action === 'status_changed' ? '#9333ea' : '#9c27b0',
                                              mt: 0.75,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography
                                              sx={{
                                                fontSize: '0.8125rem',
                                                color: 'rgba(255,255,255,0.9)',
                                                fontWeight: 500,
                                              }}
                                            >
                                              {log.changes}
                                            </Typography>
                                            <Typography
                                              sx={{
                                                fontSize: '0.75rem',
                                                color: 'rgba(255,255,255,0.7)',
                                              }}
                                            >
                                              {log.user} • {new Date(log.timestamp).toLocaleDateString('nb-NO', {
                                                day: 'numeric',
                                                month: 'short',
                                              })} {new Date(log.timestamp).toLocaleTimeString('nb-NO', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ))}
                                    </Box>
                                  )}
                                </Box>
                              )}
                            </Box>
                          </Collapse>

                          {/* Card Actions */}
                          {/* Card Actions - Enhanced */}
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              pt: { xs: 2, sm: 2.5 },
                              mt: { xs: 2, sm: 2.5 },
                              borderTop: '2px solid rgba(156,39,176,0.2)',
                            }}
                          >
                            {/* Enhanced "Vis mer" button */}
                            <Button
                              variant="contained"
                              size="medium"
                              onClick={() => toggleCardExpanded(day.id)}
                              startIcon={<VisibilityIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />}
                              endIcon={expandedCards.has(day.id) ? <ArrowUpIcon /> : <ArrowDownIcon />}
                              sx={{
                                bgcolor: expandedCards.has(day.id)
                                  ? 'rgba(156,39,176,0.25)'
                                  : 'rgba(156,39,176,0.15)',
                                color: expandedCards.has(day.id) ? '#ce93d8' : '#fff',
                                fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                                fontWeight: 600,
                                minHeight: TOUCH_TARGET_SIZE,
                                px: { xs: 2, sm: 2.5 },
                                border: expandedCards.has(day.id)
                                  ? '2px solid rgba(156,39,176,0.5)'
                                  : '2px solid rgba(156,39,176,0.3)',
                                borderRadius: 2,
                                textTransform: 'none',
                                boxShadow: expandedCards.has(day.id)
                                  ? '0 4px 12px rgba(156,39,176,0.3)'
                                  : '0 2px 8px rgba(156,39,176,0.2)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  bgcolor: 'rgba(156,39,176,0.35)',
                                  borderColor: 'rgba(156,39,176,0.6)',
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 6px 16px rgba(156,39,176,0.4)',
                                },
                                ...focusVisibleStyles,
                              }}
                            >
                              {expandedCards.has(day.id) ? 'Skjul detaljer' : 'Vis detaljer'}
                            </Button>
                            <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 } }}>
                              <Tooltip title="Generer call sheet">
                                <IconButton
                                  onClick={() => generateCallSheetForDay(day)}
                                  sx={{
                                    minWidth: TOUCH_TARGET_SIZE,
                                    minHeight: TOUCH_TARGET_SIZE,
                                    color: '#67e8f9',
                                    '&:hover': { bgcolor: 'rgba(103,232,249,0.12)' },
                                    ...focusVisibleStyles,
                                  }}
                                >
                                  <CallSheetIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Dupliser til neste dag">
                                <IconButton
                                  onClick={() => handleDuplicate(day)}
                                  sx={{ 
                                    minWidth: TOUCH_TARGET_SIZE, 
                                    minHeight: TOUCH_TARGET_SIZE, 
                                    color: 'rgba(255,255,255,0.87)',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                                    ...focusVisibleStyles,
                                  }}
                                >
                                  <DuplicateIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Rediger">
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDialog(day);
                                  }}
                                  sx={{ 
                                    minWidth: TOUCH_TARGET_SIZE, 
                                    minHeight: TOUCH_TARGET_SIZE, 
                                    color: '#9c27b0',
                                    '&:hover': { bgcolor: 'rgba(156,39,176,0.1)' },
                                    ...focusVisibleStyles,
                                  }}
                                >
                                  <EditIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Slett">
                                <IconButton
                                  onClick={() => handleDeleteWithUndo(day.id)}
                                  sx={{ 
                                    minWidth: TOUCH_TARGET_SIZE, 
                                    minHeight: TOUCH_TARGET_SIZE, 
                                    color: '#ff4444',
                                    '&:hover': { bgcolor: 'rgba(255,68,68,0.1)' },
                                    ...focusVisibleStyles,
                                  }}
                                >
                                  <DeleteIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
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
          ))}
        </Box>
      )}

      <Dialog
        open={showBulkShiftDialog}
        onClose={() => setShowBulkShiftDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1f2430', color: '#fff' }}>Bulk-flytt med konsekvenspreview</DialogTitle>
        <DialogContent sx={{ bgcolor: '#1f2430', color: '#fff' }}>
          <Typography sx={{ mt: 1, mb: 1, color: 'rgba(255,255,255,0.8)' }}>
            Flytt valgte produksjonsdager med antall dager:
          </Typography>
          <TextField
            type="number"
            value={bulkShiftDays}
            onChange={(event) => setBulkShiftDays(Number(event.target.value) || 0)}
            fullWidth
            size="small"
            sx={{
              mb: 1.5,
              '& .MuiInputBase-root': { color: '#fff' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
            }}
          />
          <Stack spacing={1}>
            {bulkShiftPreview.length === 0 ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Ingen valgte dager.</Typography>
            ) : (
              bulkShiftPreview.slice(0, 8).map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'rgba(15,23,42,0.65)',
                    border: '1px solid rgba(148,163,184,0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.85rem' }}>
                    {new Date(item.from).toLocaleDateString('nb-NO')}
                  </Typography>
                  <Typography sx={{ color: '#67e8f9', fontSize: '0.85rem', fontWeight: 700 }}>
                    {new Date(item.to).toLocaleDateString('nb-NO')}
                  </Typography>
                </Box>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#1f2430' }}>
          <Button onClick={() => setShowBulkShiftDialog(false)} sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={() => void applyBulkShift()}
            disabled={bulkShiftPreview.length === 0}
            sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
          >
            Flytt
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showDragPreviewDialog}
        onClose={() => {
          setShowDragPreviewDialog(false);
          setDraggingDayId(null);
          setDragTargetDayId(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1f2430', color: '#fff' }}>Drag/drop preview</DialogTitle>
        <DialogContent sx={{ bgcolor: '#1f2430', color: '#fff' }}>
          {(() => {
            const source = productionDays.find((day) => day.id === draggingDayId);
            const target = productionDays.find((day) => day.id === dragTargetDayId);
            if (!source || !target) {
              return <Typography sx={{ mt: 1 }}>Kunne ikke lage preview.</Typography>;
            }
            return (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
                  Flytt dag fra <strong>{new Date(source.date).toLocaleDateString('nb-NO')}</strong> til{' '}
                  <strong>{new Date(target.date).toLocaleDateString('nb-NO')}</strong>.
                </Typography>
                <Typography sx={{ color: '#fbbf24', fontSize: '0.85rem' }}>
                  Merk: Dette kan introdusere nye kollisjoner. Konfliktmotoren oppdateres automatisk.
                </Typography>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#1f2430' }}>
          <Button
            onClick={() => {
              setShowDragPreviewDialog(false);
              setDraggingDayId(null);
              setDragTargetDayId(null);
            }}
            sx={{ color: 'rgba(255,255,255,0.8)' }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={() => void applyDragMove()}
            sx={{ bgcolor: '#06b6d4', '&:hover': { bgcolor: '#0891b2' } }}
          >
            Bekreft flytt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message="Produksjonsdag slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#9c27b0' }}>
            Angre
          </Button>
        }
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: '#333' } }}
      />

      {/* Edit/Create Dialog - Responsive */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullScreen={isMobile}
        maxWidth="lg"
        fullWidth
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
              bgcolor: '#1c2128',
              color: '#fff',
              maxHeight: { xs: '100%', sm: '90vh', md: '85vh' },
              minHeight: { sm: '60vh', md: '70vh' },
              m: { xs: 0, sm: 2, md: 3, lg: 4 },
              borderRadius: { xs: 0, sm: 2, md: 3 },
              border: { xs: 'none', sm: '1px solid rgba(156,39,176,0.2)' },
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              zIndex: 100000,
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
              // iPad landscape optimization
              '@media (min-width: 1024px) and (max-width: 1366px) and (orientation: landscape)': {
                maxWidth: '90vw',
                maxHeight: '85vh',
                m: 2,
              },
              // Desktop optimization
              '@media (min-width: 1400px)': {
                maxWidth: '1200px',
              },
            },
          },
        }}
        sx={{
          zIndex: 100000,
          '& .MuiBackdrop-root': {
            zIndex: 99998,
            bgcolor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            willChange: 'opacity',
          },
        }}
      >
        {/* Enhanced Dialog Title */}
        <DialogTitle
          id={dialogTitleId}
          sx={{
            color: '#fff',
            borderBottom: '2px solid rgba(156,39,176,0.3)',
            background: 'linear-gradient(135deg, rgba(156,39,176,0.1) 0%, rgba(0,0,0,0.2) 100%)',
            fontSize: { xs: '1.1rem', sm: '1.35rem', md: '1.5rem' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: { xs: 2, sm: 2.5 },
            px: { xs: 2, sm: 3, md: 4 },
            fontWeight: 700,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 } }}>
            <Box
              sx={{
                width: { xs: 40, sm: 48, md: 52 },
                height: { xs: 40, sm: 48, md: 52 },
                borderRadius: 2,
                bgcolor: 'rgba(156,39,176,0.2)',
                border: '2px solid rgba(156,39,176,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {editingDay ? (
                <EditIcon sx={{ color: '#ce93d8', fontSize: { xs: 22, sm: 26, md: 28 } }} />
              ) : (
                <AddIcon sx={{ color: '#ce93d8', fontSize: { xs: 22, sm: 26, md: 28 } }} />
              )}
            </Box>
            <Box>
              <Typography
                component="span"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.1rem', sm: '1.35rem', md: '1.5rem' },
                  background: 'linear-gradient(135deg, #fff 0%, #ce93d8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {editingDay ? 'Rediger produksjonsdag' : 'Ny produksjonsdag'}
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                  color: 'rgba(255,255,255,0.87)',
                  display: { xs: 'none', sm: 'block' },
                }}
              >
                {editingDay
                  ? `${new Date(editingDay.date).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}`
                  : 'Fyll ut detaljer for den nye produksjonsdagen'
                }
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseDialog}
            aria-label="Lukk dialog"
            sx={{
              color: 'rgba(255,255,255,0.87)',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              minWidth: TOUCH_TARGET_SIZE,
              minHeight: TOUCH_TARGET_SIZE,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          id={dialogDescId}
          sx={{
            pt: { xs: 2, sm: 3, md: 4 },
            px: { xs: 2, sm: 3, md: 4 },
            pb: { xs: 2, sm: 3 },
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            // iPad landscape optimization
            '@media (min-width: 1024px) and (max-width: 1366px) and (orientation: landscape)': {
              px: 3,
              pt: 3,
            },
          }}
        >
          {/* Info banner */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: { xs: 1.5, sm: 2 },
              mb: { xs: 2, sm: 3 },
              borderRadius: 2,
              bgcolor: 'rgba(156,39,176,0.1)',
              border: '1px solid rgba(156,39,176,0.2)',
            }}
          >
            <CalendarMonthIcon sx={{ color: '#ce93d8', fontSize: { xs: 20, sm: 24 } }} />
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.87)',
                fontSize: { xs: '0.8125rem', sm: '0.875rem', md: '0.9375rem' },
              }}
            >
              Fyll ut informasjon om produksjonsdagen. Felter merket med * er påkrevd.
            </Typography>
          </Box>
          <Stack spacing={2.5}>
            <TextField
              label="Dato"
              type="date"
              value={formData.date || ''}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { style: { minHeight: TOUCH_TARGET_SIZE - 28 } },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="Call time"
                type="time"
                value={formData.callTime || '09:00'}
                onChange={(e) => setFormData({ ...formData, callTime: e.target.value })}
                fullWidth
                slotProps={{ 
                  inputLabel: { shrink: true },
                  htmlInput: { 'aria-label': 'Call time' },
                }}
                sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#9c27b0' },
              }}
            />
              <TextField
                label="Wrap time"
                type="time"
                value={formData.wrapTime || '17:00'}
                onChange={(e) => setFormData({ ...formData, wrapTime: e.target.value })}
                fullWidth
                slotProps={{ 
                  inputLabel: { shrink: true },
                  htmlInput: { 'aria-label': 'Wrap time' },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    minHeight: TOUCH_TARGET_SIZE,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                    '&.Mui-focused fieldset': { borderColor: '#9c27b0' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#9c27b0' },
                }}
              />
            </Box>

            <FormControl fullWidth required>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Lokasjon *</InputLabel>
              <Select
                value={formData.locationId || ''}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                label="Lokasjon *"
                sx={{
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#9c27b0' },
                }}
                MenuProps={{
                  container: document.body,
                  sx: {
                    zIndex: 100010,
                  },
                  PaperProps: {
                    sx: {
                      bgcolor: '#1c2128',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      mt: 0.5,
                      maxHeight: 300,
                      '& .MuiMenuItem-root': {
                        fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:hover': {
                          bgcolor: 'rgba(156,39,176,0.15)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(156,39,176,0.25)',
                          '&:hover': {
                            bgcolor: 'rgba(156,39,176,0.35)',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                {locations.map((location) => (
                  <MenuItem key={location.id} value={location.id} sx={{ minHeight: TOUCH_TARGET_SIZE }}>
                    {location.name} - {location.address}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Status</InputLabel>
              <Select
                value={formData.status || 'planned'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ProductionDay['status'] })}
                label="Status"
                sx={{
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#9c27b0' },
                }}
                MenuProps={{
                  container: document.body,
                  sx: {
                    zIndex: 100010,
                  },
                  PaperProps: {
                    sx: {
                      bgcolor: '#1c2128',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      mt: 0.5,
                      maxHeight: 300,
                      '& .MuiMenuItem-root': {
                        fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:hover': {
                          bgcolor: 'rgba(156,39,176,0.15)',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'rgba(156,39,176,0.25)',
                          '&:hover': {
                            bgcolor: 'rgba(156,39,176,0.35)',
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <MenuItem value="planned" sx={{ minHeight: TOUCH_TARGET_SIZE }}>Planlagt</MenuItem>
                <MenuItem value="in_progress" sx={{ minHeight: TOUCH_TARGET_SIZE }}>Pågår</MenuItem>
                <MenuItem value="completed" sx={{ minHeight: TOUCH_TARGET_SIZE }}>Fullført</MenuItem>
                <MenuItem value="cancelled" sx={{ minHeight: TOUCH_TARGET_SIZE }}>Kansellert</MenuItem>
              </Select>
            </FormControl>

            {/* Enhanced Notes Section with Animated Icon */}
            <Box
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 3,
                bgcolor: 'rgba(255,193,7,0.06)',
                border: '2px solid rgba(255,193,7,0.25)',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '5px',
                  height: '100%',
                  bgcolor: '#ffc107',
                  borderRadius: '3px 0 0 3px',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, pl: 1 }}>
                <Box
                  sx={{
                    width: { xs: 38, sm: 44 },
                    height: { xs: 38, sm: 44 },
                    borderRadius: 2,
                    bgcolor: 'rgba(255,193,7,0.15)',
                    border: '1px solid rgba(255,193,7,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '@keyframes writingDialog': {
                      '0%, 100%': {
                        transform: 'rotate(-3deg) translateY(0px)',
                      },
                      '25%': {
                        transform: 'rotate(0deg) translateY(-1px)',
                      },
                      '50%': {
                        transform: 'rotate(3deg) translateY(0px)',
                      },
                      '75%': {
                        transform: 'rotate(0deg) translateY(1px)',
                      },
                    },
                  }}
                >
                  <NotesIcon
                    sx={{
                      fontSize: { xs: 22, sm: 26 },
                      color: '#ffc107',
                      animation: 'writingDialog 2s ease-in-out infinite',
                      filter: 'drop-shadow(0 1px 3px rgba(255,193,7,0.3))',
                    }}
                  />
                </Box>
                <Box>
                  <Typography
                    sx={{
                      color: '#ffc107',
                      fontWeight: 700,
                      fontSize: { xs: '1rem', sm: '1.125rem' },
                    }}
                  >
                    Notater
                  </Typography>
                  <Typography
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    }}
                  >
                    Skriv viktig informasjon for produksjonsdagen
                  </Typography>
                </Box>
              </Box>
              <RichTextEditor
                value={formData.notes || ''}
                onChange={(value) => setFormData({ ...formData, notes: value })}
                placeholder="Skriv notater her... F.eks. spesielle instruksjoner, viktige påminnelser, kontaktpersoner, eller andre detaljer som teamet trenger å vite."
                minHeight={150}
                accentColor="#ffc107"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions 
          sx={{ 
            borderTop: '1px solid rgba(255,255,255,0.1)', 
            p: { xs: 2, sm: 2 }, 
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            gap: 1,
            position: { xs: 'sticky', sm: 'relative' },
            bottom: 0,
            bgcolor: '#1c2128',
          }}
        >
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon />}
            fullWidth={isMobile}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE, 
              ...focusVisibleStyles,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={() => handleSave()}
            variant="contained"
            startIcon={<SaveIcon />}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#9c27b0',
              color: '#fff',
              minHeight: TOUCH_TARGET_SIZE,
              ...focusVisibleStyles,
              '&:hover': {
                bgcolor: '#7b1fa2'
              }
            }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      {/* Inform Team Dialog */}
      <Dialog
        open={showInformTeamDialog}
        onClose={() => setShowInformTeamDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            borderRadius: 3,
            border: '2px solid rgba(147,51,234,0.3)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            bgcolor: 'rgba(147,51,234,0.1)',
            borderBottom: '1px solid rgba(147,51,234,0.2)',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(147,51,234,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '@keyframes ring': {
                '0%, 100%': { transform: 'rotate(-10deg)' },
                '25%': { transform: 'rotate(10deg)' },
                '50%': { transform: 'rotate(-10deg)' },
                '75%': { transform: 'rotate(10deg)' },
              },
            }}
          >
            <NotifyIcon
              sx={{
                fontSize: 28,
                color: '#9333ea',
                animation: 'ring 0.5s ease-in-out 2',
              }}
            />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#9333ea' }}>
              Informer teamet?
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Viktige endringer er gjort
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{
              bgcolor: 'rgba(147,51,234,0.1)',
              color: '#fff',
              border: '1px solid rgba(147,51,234,0.3)',
              mb: 3,
              '& .MuiAlert-icon': { color: '#9333ea' },
            }}
          >
            Følgende felt er endret og kan påvirke teamet:
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {changedFields.map((field, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'rgba(147,51,234,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {field === 'Dato' && <CalendarIcon sx={{ color: '#9333ea', fontSize: 20 }} />}
                  {field === 'Arbeidstid' && <TimeIcon sx={{ color: '#9333ea', fontSize: 20 }} />}
                  {field === 'Lokasjon' && <LocationIcon sx={{ color: '#9333ea', fontSize: 20 }} />}
                  {field === 'Notater' && <NotesIcon sx={{ color: '#9333ea', fontSize: 20 }} />}
                </Box>
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                  {field}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(156,39,176,0.1)',
              border: '1px solid rgba(156,39,176,0.2)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.9rem',
            }}
          >
            💡 <strong>Tips:</strong> Send en melding til teamet via e-post, SMS eller team-chat for å sikre at alle er oppdatert om endringene.
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            p: 2,
            gap: 1,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Button
            onClick={() => handleConfirmSaveWithNotification(false)}
            variant="outlined"
            fullWidth={isMobile}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              borderColor: 'rgba(255,255,255,0.3)',
              minHeight: TOUCH_TARGET_SIZE,
              '&:hover': { borderColor: 'rgba(255,255,255,0.5)' },
            }}
          >
            Lagre uten å varsle
          </Button>
          <Button
            onClick={() => handleConfirmSaveWithNotification(true)}
            variant="contained"
            startIcon={<NotifyIcon />}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#9333ea',
              color: '#000',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              '&:hover': { bgcolor: '#6d28d9' },
            }}
          >
            Informer teamet
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={scenePreview !== null}
        onClose={() => setScenePreview(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(156,39,176,0.28)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
              Sceneoversikt
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
              {scenePreview?.name || 'Valgt scene'}
            </Typography>
          </Box>
          <IconButton onClick={() => setScenePreview(null)} sx={{ color: 'rgba(255,255,255,0.8)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {scenePreview?.thumbnail ? (
            <Box
              component="img"
              src={scenePreview.thumbnail}
              alt={scenePreview.name}
              sx={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'cover',
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.12)',
                mb: 2,
              }}
            />
          ) : (
            <Box
              sx={{
                mb: 2,
                p: 3,
                borderRadius: 2,
                border: '1px dashed rgba(255,255,255,0.2)',
                bgcolor: 'rgba(255,255,255,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <ImageIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.72)' }}>
                Ingen forhåndsvisning er lagret for denne scenen ennå.
              </Typography>
            </Box>
          )}

          <Stack spacing={1.5}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.75rem', textTransform: 'uppercase', mb: 0.5 }}>
                Scenenavn
              </Typography>
              <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                {scenePreview?.name || 'Ikke navngitt scene'}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.75rem', textTransform: 'uppercase', mb: 0.5 }}>
                Scene-ID
              </Typography>
              <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                {scenePreview?.id || 'Ukjent'}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', p: 2 }}>
          <Button onClick={() => setScenePreview(null)} variant="contained" sx={{ bgcolor: '#9c27b0', '&:hover': { bgcolor: '#7b1fa2' } }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
