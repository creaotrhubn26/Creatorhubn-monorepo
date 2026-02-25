import { useState, useMemo, useEffect, useId, useRef, useCallback, type ChangeEvent, type DragEvent, type SyntheticEvent } from 'react';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  CardMedia,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Stack,
  Grid,
  Tooltip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  useTheme,
  useMediaQuery,
  Grow,
  InputAdornment,
  LinearProgress,
  CircularProgress,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewModule as GridViewIcon,
  ViewList as TableViewIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Image as ImageIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Block as BlockIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Bookmark as BookmarkIcon,
  ShoppingCart as ShoppingCartIcon,
  OpenInNew as OpenInNewIcon,
  PlaylistAdd as PlaylistAddIcon,
  Star as StarIcon,
  CloudUpload as CloudUploadIcon,
  Link as LinkIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Movie as MovieIcon,
  History as HistoryIcon,
  CalendarToday as CalendarTodayIcon,
  QrCode as QrCodeIcon,
  FileDownload as DownloadIcon,
  FileUpload as UploadIcon,
  FileCopy as DuplicateIcon,
  SelectAll as SelectAllIcon,
  CheckBox as CheckboxIcon,
  CheckBoxOutlineBlank as CheckboxOutlineIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Assignment as CheckOutIcon,
  AssignmentReturn as CheckInIcon,
  Summarize as ReportIcon,
  WifiOff as OfflineIcon,
  Sync as SyncIcon,
  AssignmentLate as MissingItemIcon,
} from '@mui/icons-material';
import { EquipmentIcon as BuildIcon, LocationsIcon as LocationIcon } from './icons/CastingIcons';
import { 
  Equipment, 
  equipmentApi, 
  equipmentBookingsApi, 
  equipmentAvailabilityApi,
  equipmentConflictsApi,
  equipmentCheckoutApi,
  EquipmentBooking,
  EquipmentAvailability,
  EquipmentConflict,
  EquipmentCheckout,
  crewApi,
  locationsApi,
  CastingCrew,
  CastingLocation,
  equipmentTemplatesApi,
  vendorLinksApi,
  EquipmentTemplate,
  EquipmentTemplateItem,
  VendorLink,
} from '../services/castingApiService';
import { useToast } from './ToastStack';

const TOUCH_TARGET_SIZE = 44;

const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #9333ea',
    outlineOffset: 2,
  },
};

type SortField = 'name' | 'category' | 'status' | 'condition' | 'quantity';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table' | 'gallery';

const STATUS_LABELS: Record<string, string> = {
  available: 'Tilgjengelig',
  in_use: 'I bruk',
  maintenance: 'Service',
  retired: 'Utfaset',
};

const STATUS_COLORS: Record<string, string> = {
  available: '#4caf50',
  in_use: '#2196f3',
  maintenance: '#ff9800',
  retired: '#9e9e9e',
};

const CONDITION_LABELS: Record<string, string> = {
  excellent: 'Utmerket',
  good: 'Bra',
  fair: 'Akseptabel',
  poor: 'Dårlig',
  needs_repair: 'Trenger reparasjon',
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: '#4caf50',
  good: '#8bc34a',
  fair: '#ff9800',
  poor: '#f44336',
  needs_repair: '#d32f2f',
};

const DEFAULT_CATEGORY_OPTIONS = [
  'Kamera',
  'Linse',
  'Rig',
  'Stativ',
  'Lys',
  'Lyd',
  'Optikk',
  'Strøm',
  'Transport',
  'Sikkerhet',
  'Annet',
];

import { equipmentCategoriesService } from '../services/equipmentCategoriesService';
import {
  findFirmwareForEquipment,
  lookupFirmware,
  syncFirmwareCatalog,
  addCommunityFirmwareEntry,
  checkFirmwareBatchV2,
  isScrapeBlocked,
  type FirmwareEntry,
  type FirmwareCheckStatus,
} from '../services/firmwareKnowledgeBase';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import equipPng from './icons/Keep/roleroom_equip.png';
import { EquipmentPanelProvider } from './EquipmentPanelContext';
import { EquipmentPanelDialogs } from './EquipmentPanelDialogs';
import { SceneEquipmentAdvisor } from './SceneEquipmentAdvisor';
import { EquipmentIntelligence } from './EquipmentIntelligence';

interface EquipmentManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
}

type FirmwareUpdateMatch = FirmwareCheckStatus;

export function EquipmentManagementPanel({ projectId, onUpdate }: EquipmentManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;

  const { showSuccess, showError } = useToast();

  const baseId = useId();
  const dialogTitleId = `${baseId}-dialog-title`;

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterOpen, setFilterOpen] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    brand: '',
    model: '',
    serialNumber: '',
    quantity: 1,
    condition: 'good' as Equipment['condition'],
    primaryLocationId: '',
    notes: '',
    imageUrl: '',
    status: 'available' as Equipment['status'],
    isGlobal: false, // If true, equipment is available across all projects
    firmwareCurrent: '',
    firmwareAutoCheckEnabled: true,
  });

  // Image picker state
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerTab, setImagePickerTab] = useState(0);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [imageSearchResults, setImageSearchResults] = useState<Array<{
    id: string;
    url: string;
    thumbnailUrl: string;
    description?: string;
    photographer?: string;
    source: 'unsplash' | 'pexels' | 'shotcafe' | 'pixabay' | 'openverse' | 'wikimedia';
  }>>([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchControllerRef = useRef<AbortController | null>(null);

  const [crewMembers, setCrewMembers] = useState<CastingCrew[]>([]);
  const [locations, setLocations] = useState<CastingLocation[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedEquipmentForAssign, setSelectedEquipmentForAssign] = useState<Equipment | null>(null);
  const [selectedCrewId, setSelectedCrewId] = useState('');
  const [bulkAssignCrewId, setBulkAssignCrewId] = useState('');

  const [bookingsDialogOpen, setBookingsDialogOpen] = useState(false);
  const [selectedEquipmentBookings, setSelectedEquipmentBookings] = useState<Equipment | null>(null);
  const [bookings, setBookings] = useState<EquipmentBooking[]>([]);
  const [availability, setAvailability] = useState<EquipmentAvailability[]>([]);

  const [firmwareChecking, setFirmwareChecking] = useState(false);
  const [firmwareCheckedAt, setFirmwareCheckedAt] = useState<string | null>(null);
  const [firmwareUpdatesByEquipmentId, setFirmwareUpdatesByEquipmentId] = useState<Record<string, FirmwareUpdateMatch>>({});
  const [firmwareUnmatchedCount, setFirmwareUnmatchedCount] = useState(0);

  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EquipmentTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    category: '',
    use_case: '',
    is_global: false,
    items: [] as Partial<EquipmentTemplateItem>[],
  });
  const [shopDialogOpen, setShopDialogOpen] = useState(false);
  const [vendorLinks, setVendorLinks] = useState<VendorLink[]>([]);
  const [vendorCategories, setVendorCategories] = useState<{ category: string; count: number }[]>([]);
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('all');

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Load custom categories on mount
  useEffect(() => {
    equipmentCategoriesService.getCustomCategories(projectId).then(setCustomCategories);
  }, [projectId]);

  // Combined categories (default + custom)
  const allCategories = [...DEFAULT_CATEGORY_OPTIONS, ...customCategories];

  // === NEW WORKFLOW FEATURES ===
  
  // Delete confirmation dialog (replacing browser confirm)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<Equipment | null>(null);
  
  // Bulk operations
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'delete' | 'status' | 'assign'>('delete');
  const [bulkNewStatus, setBulkNewStatus] = useState<Equipment['status']>('available');
  
  // History/audit log
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEquipmentHistory, setSelectedEquipmentHistory] = useState<Equipment | null>(null);
  const [equipmentHistory, setEquipmentHistory] = useState<Array<{
    id: string;
    action: string;
    user: string;
    timestamp: string;
    details?: string;
  }>>([]);
  
  // Maintenance scheduling
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [selectedEquipmentMaintenance, setSelectedEquipmentMaintenance] = useState<Equipment | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    scheduledDate: '',
    type: 'routine' as 'routine' | 'repair' | 'inspection' | 'calibration' | 'cleaning',
    notes: '',
    reminderDays: 7,
  });
  
  // Booking creation
  const [createBookingDialogOpen, setCreateBookingDialogOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    startDate: '',
    endDate: '',
    purpose: '',
    notes: '',
  });
  
  // Form validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Drag and drop
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ── Check-in / Check-out ───────────────────────────────
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutEquipment, setCheckoutEquipment] = useState<Equipment | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({ crewId: '', quantity: 1, purpose: '' });
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [checkinEquipment, setCheckinEquipment] = useState<Equipment | null>(null);
  const [checkinForm, setCheckinForm] = useState<{ condition: Equipment['condition']; notes: string }>({ condition: 'good', notes: '' });
  // Tracks all active (not yet checked-in) checkouts so we can resolve checkoutId for check-in
  const [activeCheckouts, setActiveCheckouts] = useState<EquipmentCheckout[]>([]);

  // ── Booking conflict warnings ──────────────────────────
  const [bookingConflicts, setBookingConflicts] = useState<EquipmentConflict[]>([]);
  const [conflictChecking, setConflictChecking] = useState(false);

  // ── Reports ────────────────────────────────────────────
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [reportsTab, setReportsTab] = useState(0);

  // ── Offline outbox — typed discriminated union ─────────
  type OfflineCheckoutEntry = {
    id: string; type: 'checkout'; ts: string;
    payload: { equipmentId: string; crewId: string; quantity: number; purpose: string };
  };
  type OfflineCheckinEntry = {
    id: string; type: 'checkin'; ts: string;
    payload: { equipmentId: string; condition: Equipment['condition']; notes: string };
  };
  type OfflineEntry = OfflineCheckoutEntry | OfflineCheckinEntry;

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [offlineOutboxOpen, setOfflineOutboxOpen] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineEntry[]>([]);

  // ── Quick preview dialog ──
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEquipment, setPreviewEquipment] = useState<Equipment | null>(null);
  const handlePreviewEquipment = (eq: Equipment) => {
    setPreviewEquipment(eq);
    setPreviewOpen(true);
  };

  const handleAddCustomCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      return;
    }
    if (allCategories.includes(trimmedName)) {
      showError('Kategorien finnes allerede');
      return;
    }

    const updated = [...customCategories, trimmedName];
    setCustomCategories(updated);
    await equipmentCategoriesService.saveCustomCategories(projectId, updated);
    setNewCategoryName('');
    setNewCategoryDialogOpen(false);
    showSuccess(`Kategori "${trimmedName}" lagt til`);
  };

  const handleRemoveCustomCategory = async (category: string) => {
    const updated = customCategories.filter(c => c !== category);
    setCustomCategories(updated);
    await equipmentCategoriesService.saveCustomCategories(projectId, updated);
    showSuccess(`Kategori "${category}" fjernet`);
  };

  const loadActiveCheckouts = async () => {
    try {
      const data = await equipmentCheckoutApi.getActive(projectId);
      setActiveCheckouts(Array.isArray(data) ? data : []);
    } catch {
      // Non-fatal: active checkout tracking is best-effort
    }
  };

  useEffect(() => {
    loadEquipment();
    loadCrewAndLocations();
    loadTemplates();
    loadActiveCheckouts();
  }, [projectId]);

  // Multi-user realtime: poll every 30 s while online
  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  loadEquipment(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    const timer = setInterval(() => { if (navigator.onLine) loadEquipment(); }, 30_000);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(timer);
    };
  }, [projectId]);

  // Offline outbox: restore queue from localStorage on mount / project change
  useEffect(() => {
    const raw = localStorage.getItem(`equipment_outbox_${projectId}`) ?? '[]';
    try {
      const q = JSON.parse(raw);
      setOfflineQueue(q);
      setOfflineQueueCount(q.length);
    } catch {
      setOfflineQueue([]);
      setOfflineQueueCount(0);
    }
  }, [projectId]);

  const loadEquipment = async () => {
    if (!projectId) return;
    setLoading(true);
    let cancelled = false;
    try {
      const data = await equipmentApi.getAll(projectId);
      if (!cancelled) setEquipment(Array.isArray(data) ? data : []);
    } catch (error) {
      if (!cancelled) {
        console.error('Error loading equipment:', error);
        showError('Kunne ikke laste utstyr');
        setEquipment([]);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  };

  const loadCrewAndLocations = async () => {
    try {
      const [crewData, locationData] = await Promise.all([
        crewApi.getAll(projectId),
        locationsApi.getAll(projectId),
      ]);
      setCrewMembers(Array.isArray(crewData) ? crewData : []);
      setLocations(Array.isArray(locationData) ? locationData : []);
    } catch (error) {
      console.error('Error loading crew/locations:', error);
    }
  };

  const loadTemplates = async () => {
    if (!projectId) return;
    try {
      const data = await equipmentTemplatesApi.getAll(projectId);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadVendorLinks = useCallback(async () => {
    try {
      const [links, categories] = await Promise.all([
        vendorLinksApi.getAll(selectedVendorCategory === 'all' ? undefined : selectedVendorCategory),
        vendorLinksApi.getCategories(),
      ]);
      setVendorLinks(Array.isArray(links) ? links : []);
      setVendorCategories(Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.error('Error loading vendor links:', error);
    }
  }, [selectedVendorCategory]);

  useEffect(() => {
    if (!shopDialogOpen) return;
    loadVendorLinks();
  }, [shopDialogOpen, loadVendorLinks]);

  // Image search functions - Multi-source search via backend proxies (no keys in client)
  const searchImages = useCallback(async (query: string) => {
    if (!query.trim()) return;

    // Cancel any previous in-flight search
    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    const { signal } = controller;

    setImageSearchLoading(true);
    setImageSearchResults([]);
    
    try {
      const results: typeof imageSearchResults = [];
      const searchPromises: Promise<void>[] = [];
      
      // 1. Pexels — via backend proxy (key stays server-side)
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `/api/references/pexels/search?q=${encodeURIComponent(query)}&per_page=8`,
            { signal }
          );
          if (response.ok) {
            const data = await response.json();
            (data.results || []).forEach((img: any) => {
              results.push({
                id: img.id,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                description: img.description || query,
                photographer: img.photographer,
                source: img.source,
              });
            });
          }
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Pexels search error:', e);
        }
      })());

      // 2. Pixabay — via backend proxy (key stays server-side)
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `/api/references/pixabay/search?q=${encodeURIComponent(query)}&per_page=8`,
            { signal }
          );
          if (response.ok) {
            const data = await response.json();
            (data.results || []).forEach((img: any) => {
              results.push({
                id: img.id,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                description: img.description || query,
                photographer: img.photographer,
                source: img.source,
              });
            });
          }
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Pixabay search error:', e);
        }
      })());

      // 3. Unsplash — via backend proxy (key stays server-side)
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `/api/references/unsplash/search?q=${encodeURIComponent(query + ' film production')}&per_page=8&orientation=landscape`,
            { signal }
          );
          if (response.ok) {
            const data = await response.json();
            (data.results || []).forEach((img: any) => {
              results.push({
                id: img.id,
                url: img.url,
                thumbnailUrl: img.thumbnailUrl,
                description: img.description || query,
                photographer: img.attribution,
                source: img.source,
              });
            });
          }
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.error('Unsplash search error:', e);
        }
      })());

      // 4. Openverse API - Creative Commons aggregator
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license_type=commercial&page_size=6`
          );
          if (response.ok) {
            const data = await response.json();
            data.results?.forEach((img: any) => {
              results.push({
                id: `openverse-${img.id}`,
                url: img.url,
                thumbnailUrl: img.thumbnail || img.url,
                description: img.title,
                photographer: img.creator,
                source: 'openverse',
              });
            });
          }
        } catch (e) {
          console.error('Openverse search error:', e);
        }
      })());

      // 5. Wikimedia Commons - Reference/documentation images
      searchPromises.push((async () => {
        try {
          const response = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&origin=*&srlimit=6`
          );
          if (response.ok) {
            const data = await response.json();
            for (const item of data.query?.search || []) {
              // Get image info for each result
              const infoRes = await fetch(
                `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(item.title)}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=400&format=json&origin=*`
              );
              if (infoRes.ok) {
                const infoData = await infoRes.json();
                const pages = infoData.query?.pages;
                const page = pages?.[Object.keys(pages)[0]];
                const imageinfo = page?.imageinfo?.[0];
                if (imageinfo?.url) {
                  results.push({
                    id: `wikimedia-${page.pageid}`,
                    url: imageinfo.url,
                    thumbnailUrl: imageinfo.thumburl || imageinfo.url,
                    description: item.title.replace('File:', '').replace(/\.[^.]+$/, ''),
                    photographer: 'Wikimedia Commons',
                    source: 'wikimedia',
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('Wikimedia search error:', e);
        }
      })());

      // 6. shot.cafe for film references
      searchPromises.push((async () => {
        try {
          const response = await fetch(`/api/shotcafe/search?z=nav&q=${encodeURIComponent(query)}`);
          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
              data.slice(0, 4).forEach((film: any) => {
                results.push({
                  id: `shotcafe-${film.pslug || film.slug}`,
                  url: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/t/${film.slug}`)}`,
                  thumbnailUrl: `/api/shotcafe/image-proxy?url=${encodeURIComponent(`https://shot.cafe/images/t/${film.slug}`)}`,
                  description: film.title,
                  photographer: film.dp,
                  source: 'shotcafe',
                });
              });
            }
          }
        } catch (e) {
          console.error('shot.cafe search error:', e);
        }
      })());

      // Wait for all searches to complete
      await Promise.allSettled(searchPromises);
      
      // Shuffle results to mix sources
      const shuffled = results.sort(() => Math.random() - 0.5);
      setImageSearchResults(shuffled);
    } catch (error) {
      console.error('Image search error:', error);
    } finally {
      setImageSearchLoading(false);
    }
  }, []);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // TODO: Replace base64 data-URL storage with signed-URL upload to object storage
    //       (e.g. Supabase Storage / S3) to avoid bloating the database row.
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFormData({ ...formData, imageUrl: dataUrl });
      setTempImageUrl(dataUrl);
      setImagePickerOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSearchImage = (imageUrl: string) => {
    setFormData({ ...formData, imageUrl });
    setTempImageUrl(imageUrl);
    setImagePickerOpen(false);
    setImageSearchResults([]);
    setImageSearchQuery('');
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      const result = await equipmentTemplatesApi.apply(templateId, projectId);
      showSuccess(`${result.count} utstyr opprettet fra mal`);
      loadEquipment();
      setTemplatesDialogOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error applying template:', error);
      showError('Kunne ikke anvende mal');
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (editingTemplate) {
        await equipmentTemplatesApi.update(editingTemplate.id, templateFormData as Partial<EquipmentTemplate>);
        showSuccess('Mal oppdatert');
      } else {
        await equipmentTemplatesApi.create(projectId, templateFormData as Partial<EquipmentTemplate>);
        showSuccess('Mal opprettet');
      }
      loadTemplates();
      setTemplateFormOpen(false);
      setEditingTemplate(null);
      setTemplateFormData({ name: '', description: '', category: '', use_case: '', is_global: false, items: [] });
    } catch (error) {
      console.error('Error saving template:', error);
      showError('Kunne ikke lagre mal');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await equipmentTemplatesApi.delete(templateId);
      showSuccess('Mal slettet');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      showError('Kunne ikke slette mal');
    }
  };

  const handleCreateTemplateFromEquipment = async () => {
    // Use selected equipment if any are selected, otherwise use all equipment
    const sourceEquipment = selectedEquipmentIds.size > 0
      ? equipment.filter(eq => selectedEquipmentIds.has(eq.id))
      : equipment;
    
    if (sourceEquipment.length === 0) {
      showError('Ingen utstyr å lage mal fra');
      return;
    }
    
    const items = sourceEquipment.map((eq, idx) => ({
      name: eq.name,
      description: eq.description,
      category: eq.category,
      brand: eq.brand,
      model: eq.model,
      quantity: eq.quantity,
      is_required: true,
      sort_order: idx,
    }));
    
    const templateName = selectedEquipmentIds.size > 0
      ? `Utstyrsmal (${sourceEquipment.length} valgt)`
      : 'Min utstyrsmal';
    const templateDesc = selectedEquipmentIds.size > 0
      ? `Opprettet fra ${sourceEquipment.length} valgte utstyr`
      : 'Opprettet fra alt eksisterende utstyr';
    
    setTemplateFormData({
      name: templateName,
      description: templateDesc,
      category: 'Produksjon',
      use_case: 'Film/Foto',
      is_global: false,
      items,
    });
    setEditingTemplate(null);
    setTemplateFormOpen(true);
    
    // Clear selection after creating template
    if (selectedEquipmentIds.size > 0) {
      setSelectedEquipmentIds(new Set());
    }
  };

  const handleOpenShopDialog = () => {
    setSelectedVendorCategory('all');
    setShopDialogOpen(true);
  };

  const handleOpenDialog = (eq?: Equipment) => {
    if (eq) {
      setEditingEquipment(eq);
      setTempImageUrl(eq.image_url || '');
      setFormData({
        name: eq.name || '',
        description: eq.description || '',
        category: eq.category || '',
        brand: eq.brand || '',
        model: eq.model || '',
        serialNumber: eq.serial_number || '',
        quantity: eq.quantity || 1,
        condition: eq.condition || 'good',
        primaryLocationId: eq.primary_location_id || '',
        notes: eq.notes || '',
        imageUrl: eq.image_url || '',
        status: eq.status || 'available',
        isGlobal: eq.is_global || !eq.project_id,
        firmwareCurrent: eq.firmware_current || '',
        firmwareAutoCheckEnabled: eq.firmware_auto_check_enabled ?? true,
      });
    } else {
      setEditingEquipment(null);
      setTempImageUrl('');
      setFormData({
        name: '',
        description: '',
        category: '',
        brand: '',
        model: '',
        serialNumber: '',
        quantity: 1,
        condition: 'good',
        primaryLocationId: '',
        notes: '',
        imageUrl: '',
        status: 'available',
        isGlobal: false,
        firmwareCurrent: '',
        firmwareAutoCheckEnabled: true,
      });
      setFormErrors({}); // Clear validation errors
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Use enhanced validation
    if (!validateForm()) {
      showError('Vennligst rett opp feil i skjemaet');
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      brand: formData.brand,
      model: formData.model,
      serial_number: formData.serialNumber,
      quantity: formData.quantity,
      condition: formData.condition,
      primary_location_id: formData.primaryLocationId || undefined,
      notes: formData.notes,
      image_url: formData.imageUrl,
      status: formData.status,
      project_id: formData.isGlobal ? undefined : projectId, // undefined = global equipment
      is_global: formData.isGlobal,
      firmware_current: formData.firmwareCurrent || undefined,
      firmware_auto_check_enabled: formData.firmwareAutoCheckEnabled,
    } satisfies Partial<Equipment>;

    try {
      if (editingEquipment) {
        await equipmentApi.update(editingEquipment.id, payload);
        showSuccess('Utstyr oppdatert');
      } else {
        await equipmentApi.create(payload);
        showSuccess('Utstyr opprettet');
      }
      setDialogOpen(false);
      loadEquipment();
      onUpdate?.();

      // ── Auto-publish firmware to shared catalog ──────────────
      // If the saved equipment has brand+model and we have firmware
      // info in the built-in KB, push it to the backend so all
      // users see it in the community catalog.
      if (payload.brand?.trim() && payload.model?.trim()) {
        const match = lookupFirmware(payload.brand, payload.model);
        if (match) {
          addCommunityFirmwareEntry(match).catch(() => { /* silent */ });
        }
      }
    } catch (error) {
      console.error('Error saving equipment:', error);
      showError('Kunne ikke lagre utstyr');
    }
  };

  const checkFirmwareUpdates = useCallback(async () => {
    const candidates = equipment.filter(eq => (eq.brand || '').trim() && (eq.model || '').trim());
    if (candidates.length === 0) {
      showError('Ingen utstyr med merke og modell for firmware-søk');
      return;
    }

    setFirmwareChecking(true);
    try {
      // ── 0. Sync community catalog from backend first ──────────
      await syncFirmwareCatalog();

      // ── 1. Use v2 batch check API (handles track-key matching) ──
      const batchItems = candidates.map(eq => ({
        equipmentId: eq.id,
        brand: eq.brand || '',
        model: eq.model || '',
        currentVersion: eq.firmware_current || undefined,
      }));

      const results = await checkFirmwareBatchV2(batchItems);

      setFirmwareUpdatesByEquipmentId(results);
      setFirmwareCheckedAt(new Date().toISOString());

      // ── 2. Count statuses ────────────────────────────────────
      const statuses = Object.values(results);
      const updateCount = statuses.filter(s => s.status === 'update-available').length;
      const unknownCount = statuses.filter(s => s.status === 'unknown' || s.status === 'needs-mapping').length;
      const upToDateCount = statuses.filter(s => s.status === 'up-to-date').length;

      setFirmwareUnmatchedCount(unknownCount);

      // ── 3. Auto-push matched firmware to community catalog ───
      const localMatches = findFirmwareForEquipment(
        candidates.map(eq => ({ id: eq.id, brand: eq.brand, model: eq.model }))
      );
      for (const [, entry] of Object.entries(localMatches) as [string, FirmwareEntry][]) {
        addCommunityFirmwareEntry(entry).catch(() => { /* silent */ });
      }

      if (updateCount > 0) {
        const msg = `Fant ${updateCount} firmware-oppdatering${updateCount === 1 ? '' : 'er'}`;
        const upMsg = upToDateCount > 0 ? ` · ${upToDateCount} oppdatert` : '';
        const unmatchedMsg = unknownCount > 0 ? ` · ${unknownCount} uten firmware-info` : '';
        showSuccess(msg + upMsg + unmatchedMsg);
      } else if (upToDateCount > 0) {
        showSuccess(`Alt utstyr er oppdatert (${upToDateCount} sjekket)`);
      } else {
        showSuccess('Ingen firmware-informasjon funnet');
      }
    } catch (error) {
      console.error('Firmware check error:', error);
      showError('Kunne ikke finne firmware-oppdateringer');
    } finally {
      setFirmwareChecking(false);
    }
  }, [equipment, showError, showSuccess]);

  const handleOpenAssign = (eq: Equipment) => {
    setSelectedEquipmentForAssign(eq);
    setSelectedCrewId('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedEquipmentForAssign || !selectedCrewId) return;
    
    try {
      await equipmentApi.assign(selectedEquipmentForAssign.id, selectedCrewId, 'responsible');
      showSuccess('Utstyrsansvarlig tilordnet');
      setAssignDialogOpen(false);
      loadEquipment();
    } catch (error) {
      console.error('Error assigning equipment:', error);
      showError('Kunne ikke tilordne ansvarlig');
    }
  };

  const handleUnassign = async (equipmentId: string, crewId: string) => {
    try {
      await equipmentApi.unassign(equipmentId, crewId);
      showSuccess('Tilordning fjernet');
      loadEquipment();
    } catch (error) {
      console.error('Error unassigning equipment:', error);
      showError('Kunne ikke fjerne tilordning');
    }
  };

  const handleOpenBookings = async (eq: Equipment) => {
    setSelectedEquipmentBookings(eq);
    setBookingsDialogOpen(true);
    try {
      const [bookingsData, availabilityData] = await Promise.all([
        equipmentBookingsApi.getAll(eq.id),
        equipmentAvailabilityApi.getAll(eq.id),
      ]);
      setBookings(bookingsData);
      setAvailability(availabilityData);
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  };

  // === NEW WORKFLOW HANDLERS ===

  // 1. Styled delete confirmation
  const handleDeleteClick = (eq: Equipment) => {
    setEquipmentToDelete(eq);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!equipmentToDelete) return;
    try {
      await equipmentApi.delete(equipmentToDelete.id);
      showSuccess(`"${equipmentToDelete.name}" ble slettet`);
      loadEquipment();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      showError('Kunne ikke slette utstyr');
    } finally {
      setDeleteDialogOpen(false);
      setEquipmentToDelete(null);
    }
  };

  // 2. Duplicate equipment
  const handleDuplicate = (eq: Equipment) => {
    setEditingEquipment(null);
    setTempImageUrl(eq.image_url || '');
    setFormData({
      name: `${eq.name} (kopi)`,
      description: eq.description || '',
      category: eq.category || '',
      brand: eq.brand || '',
      model: eq.model || '',
      serialNumber: '', // Clear serial number for duplicate
      quantity: eq.quantity || 1,
      condition: eq.condition || 'good',
      primaryLocationId: eq.primary_location_id || '',
      notes: eq.notes || '',
      imageUrl: eq.image_url || '',
      status: 'available', // Reset status for new item
      isGlobal: eq.is_global || false, // Preserve global status
      firmwareCurrent: eq.firmware_current || '',
      firmwareAutoCheckEnabled: eq.firmware_auto_check_enabled ?? true,
    });
    setDialogOpen(true);
    showSuccess('Utstyr duplisert - rediger og lagre');
  };

  // 3. Bulk operations
  const toggleSelectEquipment = (id: string) => {
    const newSelected = new Set(selectedEquipmentIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEquipmentIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEquipmentIds.size === filteredEquipment.length) {
      setSelectedEquipmentIds(new Set());
    } else {
      setSelectedEquipmentIds(new Set(filteredEquipment.map(eq => eq.id)));
    }
  };

  const handleBulkAction = (type: 'delete' | 'status' | 'assign') => {
    if (selectedEquipmentIds.size === 0) {
      showError('Velg minst ett utstyr');
      return;
    }
    setBulkActionType(type);
    setBulkActionDialogOpen(true);
  };

  const handleConfirmBulkAction = async () => {
    const ids = Array.from(selectedEquipmentIds);
    try {
      if (bulkActionType === 'delete') {
        const results = await Promise.allSettled(ids.map(id => equipmentApi.delete(id)));
        const failed = results.filter(r => r.status === 'rejected').length;
        const ok = ids.length - failed;
        if (failed > 0) showError(`${ok} slettet, ${failed} feilet`);
        else showSuccess(`${ok} utstyr slettet`);
      } else if (bulkActionType === 'status') {
        const results = await Promise.allSettled(ids.map(id => equipmentApi.update(id, { status: bulkNewStatus })));
        const failed = results.filter(r => r.status === 'rejected').length;
        const ok = ids.length - failed;
        if (failed > 0) showError(`${ok} oppdatert, ${failed} feilet`);
        else showSuccess(`Status oppdatert for ${ok} utstyr`);
      } else if (bulkActionType === 'assign') {
        if (bulkAssignCrewId) {
          const results = await Promise.allSettled(ids.map(id => equipmentApi.assign(id, bulkAssignCrewId, 'responsible')));
          const failed = results.filter(r => r.status === 'rejected').length;
          const ok = ids.length - failed;
          if (failed > 0) showError(`${ok} tilordnet, ${failed} feilet`);
          else showSuccess(`${ok} utstyr tilordnet`);
        }
      }
      setSelectedEquipmentIds(new Set());
      setBulkAssignCrewId('');
      loadEquipment();
      onUpdate?.();
    } catch (error) {
      console.error('Bulk action error:', error);
      showError('En feil oppstod under masseoperasjonen');
    } finally {
      setBulkActionDialogOpen(false);
    }
  };

  // 4. Export/Import CSV
  const handleExportCSV = () => {
    const headers = ['Navn', 'Kategori', 'Merke', 'Modell', 'Serienummer', 'Antall', 'Status', 'Tilstand', 'Beskrivelse', 'Notater'];
    const rows = equipment.map(eq => [
      eq.name || '',
      eq.category || '',
      eq.brand || '',
      eq.model || '',
      eq.serial_number || '',
      String(eq.quantity || 1),
      STATUS_LABELS[eq.status || 'available'] || eq.status,
      CONDITION_LABELS[eq.condition || 'good'] || eq.condition,
      eq.description || '',
      eq.notes || '',
    ]);
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `utstyrsliste-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showSuccess('Utstyrsliste eksportert');
  };

  const handleImportCSV = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;

        // RFC 4180-compliant CSV parser — handles quoted fields and embedded delimiters
        const parseCSVRow = (line: string, delimiter = ';'): string[] => {
          const result: string[] = [];
          let field = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
              if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
              else if (ch === '"') inQuotes = false;
              else field += ch;
            } else {
              if (ch === '"') { inQuotes = true; }
              else if (ch === delimiter) { result.push(field.trim()); field = ''; }
              else field += ch;
            }
          }
          result.push(field.trim());
          return result;
        };

        // Auto-detect delimiter (semicolon vs comma)
        const firstLine = text.split(/\r?\n/)[0] || '';
        const delimiter = firstLine.includes(';') ? ';' : ',';

        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) {
          showError('Filen er tom eller ugyldig');
          return;
        }
        
        const headers = parseCSVRow(lines[0], delimiter).map(h => h.toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('navn'));
        const categoryIdx = headers.findIndex(h => h.includes('kategori'));
        const brandIdx = headers.findIndex(h => h.includes('merke'));
        const modelIdx = headers.findIndex(h => h.includes('modell'));
        const serialIdx = headers.findIndex(h => h.includes('serienummer'));
        const quantityIdx = headers.findIndex(h => h.includes('antall'));
        const descIdx = headers.findIndex(h => h.includes('beskrivelse'));
        
        const rowsToImport = lines.slice(1).map(line => parseCSVRow(line, delimiter));
        const validRows = rowsToImport.filter(cols => nameIdx >= 0 && cols[nameIdx]);

        // Batch creates in parallel (max concurrency avoids overwhelming the API)
        const BATCH_SIZE = 10;
        let imported = 0;
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(batch.map(cols =>
            equipmentApi.create({
              project_id: projectId,
              name: cols[nameIdx],
              category: categoryIdx >= 0 ? cols[categoryIdx] : '',
              brand: brandIdx >= 0 ? cols[brandIdx] : '',
              model: modelIdx >= 0 ? cols[modelIdx] : '',
              serial_number: serialIdx >= 0 ? cols[serialIdx] : '',
              quantity: quantityIdx >= 0 ? parseInt(cols[quantityIdx]) || 1 : 1,
              description: descIdx >= 0 ? cols[descIdx] : '',
              status: 'available',
              condition: 'good',
            })
          ));
          imported += results.filter(r => r.status === 'fulfilled').length;
        }
        
        showSuccess(`${imported} av ${validRows.length} utstyr importert`);
        loadEquipment();
        onUpdate?.();
      } catch (error) {
        console.error('Import error:', error);
        showError('Kunne ikke importere fil');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // 5. QR Code generation
  const generateQRCode = (eq: Equipment): string => {
    // Only embed the equipment's own identifiers — no project context to avoid data leaks
    // via third-party QR service logs.
    const data = JSON.stringify({
      id: eq.id,
      name: eq.name,
      serial: eq.serial_number,
    });
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  };

  const handlePrintQR = (eq: Equipment) => {
    const qrUrl = generateQRCode(eq);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>QR-kode: ${eq.name}</title></head>
          <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
            <h2>${eq.name}</h2>
            <img src="${qrUrl}" alt="QR Code" />
            <p>Serienummer: ${eq.serial_number || 'N/A'}</p>
            <p style="color:#666;font-size:12px;">ID: ${eq.id}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  // 6. History/audit log (mock data - would connect to real API)
  const handleOpenHistory = (eq: Equipment) => {
    setSelectedEquipmentHistory(eq);
    // Mock history data - in production, fetch from API
    setEquipmentHistory([
      { id: '1', action: 'Opprettet', user: 'System', timestamp: eq.created_at || new Date().toISOString(), details: 'Utstyr lagt til i katalogen' },
      { id: '2', action: 'Status endret', user: 'Bruker', timestamp: new Date().toISOString(), details: `Status satt til ${STATUS_LABELS[eq.status || 'available']}` },
      ...(eq.assignees?.map((a, i) => ({
        id: `assign-${i}`,
        action: 'Tilordnet',
        user: 'Bruker',
        timestamp: new Date().toISOString(),
        details: `Tilordnet til ${getCrewName(a.crew_id)}`,
      })) || []),
    ]);
    setHistoryDialogOpen(true);
  };

  // 7. Maintenance scheduling
  const handleOpenMaintenance = (eq: Equipment) => {
    setSelectedEquipmentMaintenance(eq);
    setMaintenanceForm({
      scheduledDate: '',
      type: 'routine',
      notes: '',
      reminderDays: 7,
    });
    setMaintenanceDialogOpen(true);
  };

  const handleScheduleMaintenance = async () => {
    if (!selectedEquipmentMaintenance || !maintenanceForm.scheduledDate) {
      showError('Velg en dato');
      return;
    }
    try {
      // Create an availability block for maintenance
      await equipmentAvailabilityApi.create(selectedEquipmentMaintenance.id, {
        start_date: maintenanceForm.scheduledDate,
        end_date: maintenanceForm.scheduledDate,
        status: 'service',
        reason: `${maintenanceForm.type}: ${maintenanceForm.notes}`,
      });
      // Update equipment status if needed
      if (new Date(maintenanceForm.scheduledDate) <= new Date()) {
        await equipmentApi.update(selectedEquipmentMaintenance.id, { status: 'maintenance' });
      }
      showSuccess('Vedlikehold planlagt');
      setMaintenanceDialogOpen(false);
      loadEquipment();
    } catch (error) {
      console.error('Maintenance scheduling error:', error);
      showError('Kunne ikke planlegge vedlikehold');
    }
  };

  // 8. Booking creation
  const handleOpenCreateBooking = () => {
    if (!selectedEquipmentBookings) return;
    setBookingForm({
      startDate: '',
      endDate: '',
      purpose: '',
      notes: '',
    });
    setCreateBookingDialogOpen(true);
  };

  const handleCreateBooking = async () => {
    if (!selectedEquipmentBookings || !bookingForm.startDate || !bookingForm.endDate) {
      showError('Fyll inn start- og sluttdato');
      return;
    }
    // Warn on conflicts but still allow creation (user-override flow)
    if (bookingConflicts.length > 0) {
      const ok = window.confirm(
        `Det finnes ${bookingConflicts.length} konflikt(er) i denne perioden. Vil du opprette bookingen likevel?`
      );
      if (!ok) return;
    }
    try {
      await equipmentBookingsApi.create(selectedEquipmentBookings.id, {
        start_date: bookingForm.startDate,
        end_date: bookingForm.endDate,
        purpose: bookingForm.purpose,
        notes: bookingForm.notes,
        status: 'pending',
      });
      showSuccess('Booking opprettet');
      setBookingConflicts([]);
      setCreateBookingDialogOpen(false);
      handleOpenBookings(selectedEquipmentBookings);
    } catch (error) {
      console.error('Booking creation error:', error);
      showError('Kunne ikke opprette booking');
    }
  };

  // Check for booking conflicts whenever both dates are filled
  const checkBookingConflicts = async (startDate: string, endDate: string) => {
    if (!selectedEquipmentBookings || !startDate || !endDate) {
      setBookingConflicts([]);
      return;
    }
    setConflictChecking(true);
    try {
      const { conflicts } = await equipmentConflictsApi.check(
        selectedEquipmentBookings.id, startDate, endDate
      );
      setBookingConflicts(conflicts);
    } catch {
      setBookingConflicts([]);
    } finally {
      setConflictChecking(false);
    }
  };

  // ── Check-out / Check-in ─────────────────────────────────
  const OUTBOX_KEY = `equipment_outbox_${projectId}`;

  const persistOfflineQueue = (q: OfflineEntry[]) => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(q));
    setOfflineQueue(q);
    setOfflineQueueCount(q.length);
  };

  const handleOpenCheckout = (eq: Equipment) => {
    setCheckoutEquipment(eq);
    setCheckoutForm({ crewId: '', quantity: 1, purpose: '' });
    setCheckoutDialogOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!checkoutEquipment || !checkoutForm.crewId) return;
    const payload: OfflineCheckoutEntry['payload'] = {
      equipmentId: checkoutEquipment.id,
      crewId: checkoutForm.crewId,
      quantity: checkoutForm.quantity,
      purpose: checkoutForm.purpose,
    };
    if (!isOnline) {
      const entry: OfflineCheckoutEntry = { id: crypto.randomUUID(), type: 'checkout', payload, ts: new Date().toISOString() };
      persistOfflineQueue([...offlineQueue, entry]);
      showSuccess('Lagret i offline-kø — synkroniseres når du er online');
      setCheckoutDialogOpen(false);
      return;
    }
    try {
      // Create the checkout record via the proper API, which also sets equipment status
      const checkout = await equipmentCheckoutApi.checkOut(checkoutEquipment.id, {
        checked_out_to: checkoutForm.crewId,
        quantity: checkoutForm.quantity,
        purpose: checkoutForm.purpose,
      });
      // If backend doesn't update status automatically, do it explicitly
      await equipmentApi.update(checkoutEquipment.id, { status: 'in_use' });
      setActiveCheckouts(prev => [...prev, checkout]);
      showSuccess(`${checkoutEquipment.name} sjekket ut`);
      setCheckoutDialogOpen(false);
      loadEquipment();
    } catch {
      // Fallback: update status directly if checkout API is not yet deployed
      try {
        await equipmentApi.update(checkoutEquipment.id, { status: 'in_use' });
        await equipmentApi.assign(checkoutEquipment.id, checkoutForm.crewId, 'responsible');
        showSuccess(`${checkoutEquipment.name} sjekket ut (lokal status)`);
        setCheckoutDialogOpen(false);
        loadEquipment();
      } catch {
        showError('Kunne ikke sjekke ut utstyr');
      }
    }
  };

  const handleOpenCheckin = (eq: Equipment) => {
    setCheckinEquipment(eq);
    setCheckinForm({ condition: eq.condition, notes: '' });
    setCheckinDialogOpen(true);
  };

  const handleConfirmCheckin = async () => {
    if (!checkinEquipment) return;
    const payload: OfflineCheckinEntry['payload'] = {
      equipmentId: checkinEquipment.id,
      condition: checkinForm.condition,
      notes: checkinForm.notes,
    };
    if (!isOnline) {
      const entry: OfflineCheckinEntry = { id: crypto.randomUUID(), type: 'checkin', payload, ts: new Date().toISOString() };
      persistOfflineQueue([...offlineQueue, entry]);
      showSuccess('Lagret i offline-kø — synkroniseres når du er online');
      setCheckinDialogOpen(false);
      return;
    }
    // Find the active checkout record for this equipment
    const activeCheckout = activeCheckouts.find(c => c.equipment_id === checkinEquipment.id);
    try {
      if (activeCheckout) {
        // Use the proper check-in API with the real checkout ID
        await equipmentCheckoutApi.checkIn(activeCheckout.id, {
          condition_on_return: checkinForm.condition,
          notes: checkinForm.notes || undefined,
        });
        setActiveCheckouts(prev => prev.filter(c => c.id !== activeCheckout.id));
      }
      // Always update equipment status and condition directly as well
      await equipmentApi.update(checkinEquipment.id, {
        status: 'available',
        condition: checkinForm.condition,
        notes: checkinForm.notes || undefined,
      });
      showSuccess(`${checkinEquipment.name} levert inn`);
      setCheckinDialogOpen(false);
      loadEquipment();
    } catch {
      showError('Kunne ikke sjekke inn utstyr');
    }
  };

  /** Replay offline outbox when user is back online */
  const handleSyncOfflineQueue = async () => {
    if (!isOnline || offlineQueue.length === 0) return;
    let ok = 0;
    const failed: OfflineEntry[] = [];
    for (const entry of offlineQueue) {
      try {
        if (entry.type === 'checkout') {
          const { equipmentId, crewId, quantity, purpose } = entry.payload;
          await equipmentCheckoutApi.checkOut(equipmentId, {
            checked_out_to: crewId,
            quantity,
            purpose,
          });
          await equipmentApi.update(equipmentId, { status: 'in_use' });
        } else {
          const { equipmentId, condition, notes } = entry.payload;
          // Try to find active checkout to record proper check-in
          const checkout = activeCheckouts.find(c => c.equipment_id === equipmentId);
          if (checkout) {
            await equipmentCheckoutApi.checkIn(checkout.id, { condition_on_return: condition, notes: notes || undefined });
          }
          await equipmentApi.update(equipmentId, { status: 'available', condition });
        }
        ok++;
      } catch {
        failed.push(entry);
      }
    }
    persistOfflineQueue(failed);
    if (ok > 0) {
      loadEquipment();
      loadActiveCheckouts();
    }
    showSuccess(`Synkronisert ${ok} operasjon(er).${failed.length > 0 ? ` ${failed.length} feilet.` : ''}`);
  };

  // ── Reports ──────────────────────────────────────────────
  const downloadCSV = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadGearList = () => {
    const header = ['Navn', 'Kategori', 'Merke', 'Modell', 'Status', 'Tilstand', 'Antall', 'Serienummer', 'Ansvarlig'];
    const rows = equipment.map(eq => [
      eq.name, eq.category ?? '', eq.brand ?? '', eq.model ?? '',
      STATUS_LABELS[eq.status] ?? eq.status,
      CONDITION_LABELS[eq.condition] ?? eq.condition,
      String(eq.quantity), eq.serial_number ?? '',
      getCrewName(eq.assignees?.[0]?.crew_id ?? ''),
    ]);
    downloadCSV([header, ...rows], `gear-list-${projectId}.csv`);
  };

  const missingItems = useMemo(
    () => equipment.filter(eq => eq.status === 'available' && !eq.assignees?.length),
    [equipment]
  );

  const maintenanceItems = useMemo(
    () => equipment.filter(eq => eq.status === 'maintenance' || eq.condition === 'needs_repair'),
    [equipment]
  );

  // 9. Form validation

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Navn er påkrevd';
    } else if (formData.name.length < 2) {
      errors.name = 'Navn må være minst 2 tegn';
    }
    
    if (formData.serialNumber && equipment.some(eq => 
      eq.serial_number === formData.serialNumber && eq.id !== editingEquipment?.id
    )) {
      errors.serialNumber = 'Serienummeret finnes allerede';
    }
    
    if (formData.quantity < 1) {
      errors.quantity = 'Antall må være minst 1';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 10. Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const file = files[0];
      // TODO: Replace base64 data-URL storage with signed-URL upload to object storage
      //       (e.g. Supabase Storage / S3) to avoid bloating the database row.
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setFormData({ ...formData, imageUrl: dataUrl });
        setTempImageUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredEquipment = useMemo(() => {
    let filtered = [...equipment];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(eq =>
        eq.name?.toLowerCase().includes(query) ||
        eq.description?.toLowerCase().includes(query) ||
        eq.brand?.toLowerCase().includes(query) ||
        eq.model?.toLowerCase().includes(query) ||
        eq.serial_number?.toLowerCase().includes(query)
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(eq => eq.category === categoryFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(eq => eq.status === statusFilter);
    }
    
    filtered.sort((a, b) => {
      // Treat quantity as a number so that 0 sorts correctly (not as falsy empty string)
      if (sortField === 'quantity') {
        const aNum = typeof a.quantity === 'number' ? a.quantity : 0;
        const bNum = typeof b.quantity === 'number' ? b.quantity : 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      let aVal: string = (a[sortField] as string | undefined) ?? '';
      let bVal: string = (b[sortField] as string | undefined) ?? '';
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [equipment, searchQuery, categoryFilter, statusFilter, sortField, sortDirection]);

  // Categories for filter dropdown: combines equipment categories + custom categories
  const categories = useMemo(() => {
    const equipmentCats = new Set(equipment.map(eq => eq.category).filter((c): c is string => Boolean(c)));
    const allCats = new Set([...equipmentCats, ...customCategories]);
    return Array.from(allCats).sort();
  }, [equipment, customCategories]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // O(1) lookups — avoids O(n) linear search on every render
  const crewById = useMemo(
    () => new Map(crewMembers.map(c => [c.id, c])),
    [crewMembers]
  );
  const locationById = useMemo(
    () => new Map(locations.map(l => [l.id, l])),
    [locations]
  );

  const getCrewName = (crewId: string) => crewById.get(crewId)?.name ?? 'Ukjent';
  const getLocationName = (locationId: string) => locationById.get(locationId)?.name ?? '';

  // Category icon colors for visual enhancement
  const getCategoryColor = (category: string | undefined): string => {
    const colorMap: Record<string, string> = {
      camera: '#e91e63',
      kamera: '#e91e63',
      lighting: '#ffeb3b',
      lys: '#ffeb3b',
      audio: '#9c27b0',
      lyd: '#9c27b0',
      grip: '#795548',
      rig: '#795548',
      safety: '#7c3aed',
      sikkerhet: '#7c3aed',
      transport: '#607d8b',
      props: '#00bcd4',
      wardrobe: '#3f51b5',
      makeup: '#f06292',
      linse: '#2196f3',
      optikk: '#00bcd4',
      stativ: '#8d6e63',
      strøm: '#ffc107',
      annet: '#9e9e9e',
      default: '#9e9e9e',
    };
    return colorMap[category?.toLowerCase() || 'default'] || colorMap.default;
  };

  // ── Context value for child components (dialogs, views) ──
  const contextValue = {
    projectId,
    isMobile, isTablet, isDesktop,
    showSuccess, showError,
    dialogTitleId,
    equipment, loading,
    searchQuery, setSearchQuery,
    categoryFilter, setCategoryFilter,
    statusFilter, setStatusFilter,
    viewMode, setViewMode,
    sortField, sortDirection,
    filterOpen, setFilterOpen,
    filteredEquipment, allCategories,
    dialogOpen, setDialogOpen,
    editingEquipment, formData, setFormData, formErrors,
    handleOpenDialog, handleSave, validateForm,
    imagePickerOpen, setImagePickerOpen,
    imagePickerTab, setImagePickerTab,
    imageSearchQuery, setImageSearchQuery,
    imageSearchResults, imageSearchLoading,
    searchImages, handleFileUpload, handleSelectSearchImage,
    tempImageUrl, setTempImageUrl, fileInputRef,
    crewMembers, locations,
    assignDialogOpen, setAssignDialogOpen,
    selectedEquipmentForAssign, selectedCrewId, setSelectedCrewId,
    handleOpenAssign, handleAssign, handleUnassign,
    bookingsDialogOpen, setBookingsDialogOpen,
    selectedEquipmentBookings, bookings, availability,
    handleOpenBookings,
    createBookingDialogOpen, setCreateBookingDialogOpen,
    bookingForm, setBookingForm,
    handleOpenCreateBooking, handleCreateBooking,
    bookingConflicts, conflictChecking,
    checkBookingConflicts,
    firmwareChecking, firmwareCheckedAt,
    firmwareUpdatesByEquipmentId, firmwareUnmatchedCount,
    checkFirmwareUpdates,
    templates, templatesDialogOpen, setTemplatesDialogOpen,
    templateFormOpen, setTemplateFormOpen,
    editingTemplate, setEditingTemplate,
    templateFormData, setTemplateFormData,
    handleApplyTemplate, handleSaveTemplate,
    handleDeleteTemplate, handleCreateTemplateFromEquipment,
    shopDialogOpen, setShopDialogOpen,
    vendorLinks, vendorCategories,
    selectedVendorCategory, setSelectedVendorCategory,
    handleOpenShopDialog,
    newCategoryDialogOpen, setNewCategoryDialogOpen,
    newCategoryName, setNewCategoryName,
    handleAddCustomCategory, handleRemoveCustomCategory, customCategories,
    deleteDialogOpen, setDeleteDialogOpen,
    equipmentToDelete, handleDeleteClick, handleConfirmDelete,
    selectedEquipmentIds, bulkActionDialogOpen, setBulkActionDialogOpen,
    bulkActionType, setBulkActionType,
    bulkNewStatus, setBulkNewStatus,
    bulkAssignCrewId, setBulkAssignCrewId,
    toggleSelectEquipment, toggleSelectAll,
    handleBulkAction, handleConfirmBulkAction,
    historyDialogOpen, setHistoryDialogOpen,
    selectedEquipmentHistory, equipmentHistory, handleOpenHistory,
    maintenanceDialogOpen, setMaintenanceDialogOpen,
    selectedEquipmentMaintenance, maintenanceForm, setMaintenanceForm,
    handleOpenMaintenance, handleScheduleMaintenance,
    maintenanceItems, missingItems,
    handleDuplicate,
    handleExportCSV, handleImportCSV, handleDownloadGearList,
    generateQRCode, handlePrintQR,
    handleSort,
    checkoutDialogOpen, setCheckoutDialogOpen,
    checkoutEquipment, checkoutForm, setCheckoutForm,
    handleOpenCheckout, handleConfirmCheckout,
    checkinDialogOpen, setCheckinDialogOpen,
    checkinEquipment, checkinForm, setCheckinForm,
    handleOpenCheckin, handleConfirmCheckin,
    reportsDialogOpen, setReportsDialogOpen,
    reportsTab, setReportsTab,
    isOnline, offlineQueueCount,
    offlineOutboxOpen, setOfflineOutboxOpen,
    offlineQueue, handleSyncOfflineQueue, persistOfflineQueue,
    isDragging, dropZoneRef,
    handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
    activeCheckouts,
    previewOpen, setPreviewOpen, previewEquipment, handlePreviewEquipment,
    getCategoryColor, getCrewName, getLocationName, categories,
    loadEquipment,
  };

  return (
    <EquipmentPanelProvider value={contextValue}>
    <Box
      ref={dropZoneRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{ p: containerPadding, position: 'relative' }}
    >
      {/* Drag‑and‑drop overlay */}
      {isDragging && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          bgcolor: 'rgba(147,51,234,0.15)', backdropFilter: 'blur(4px)',
          border: '3px dashed #9333ea', borderRadius: 4,
        }}>
          <CloudUploadIcon sx={{ fontSize: 64, color: '#c084fc' }} />
          <Typography variant="h6" sx={{ color: '#c084fc', fontWeight: 700 }}>
            Slipp bilde for å laste opp
          </Typography>
        </Box>
      )}
      {loading && <LinearProgress sx={{ mb: 2, bgcolor: 'rgba(147,51,234,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#9333ea' } }} />}

      <ContextualNudgeBanner context="equipment" accentColor="#9333ea" />

      {/* Header with gradient background */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', 
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
        p: 2,
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(109,40,217,0.1) 100%)',
        border: '1px solid rgba(147,51,234,0.2)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(147,51,234,0.3)',
          }}>
            <BuildIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ 
              fontWeight: 700, 
              color: '#fff',
              fontSize: isDesktop ? '1.5rem' : isTablet ? '1.25rem' : '1.1rem',
            }}>
              Utstyrskatalog
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {filteredEquipment.length} av {equipment.length} elementer
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Oppdater">
            <IconButton
              onClick={loadEquipment}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', transform: 'rotate(180deg)', transition: 'transform 0.3s' },
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Filtrer">
            <IconButton
              onClick={() => setFilterOpen(!filterOpen)}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: filterOpen ? 'rgba(147,51,234,0.2)' : 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(147,51,234,0.2)' },
              }}
            >
              <FilterIcon sx={{ color: filterOpen ? '#9333ea' : 'inherit' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={viewMode === 'grid' ? 'Tabellvisning' : viewMode === 'table' ? 'Gallerivisning' : 'Rutenettvisning'}>
            <Tabs
              value={viewMode}
              onChange={(_e, v: ViewMode) => setViewMode(v)}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiTab-root': {
                  minHeight: TOUCH_TARGET_SIZE,
                  minWidth: TOUCH_TARGET_SIZE,
                  p: 0.5,
                  color: 'rgba(255,255,255,0.6)',
                  '&.Mui-selected': { color: '#c084fc' },
                },
                '& .MuiTabs-indicator': { bgcolor: '#9333ea' },
              }}
            >
              <Tab value="grid" icon={<GridViewIcon sx={{ fontSize: 20 }} />} aria-label="Rutenett" />
              <Tab value="table" icon={<TableViewIcon sx={{ fontSize: 20 }} />} aria-label="Tabell" />
              <Tab value="gallery" icon={<PhotoLibraryIcon sx={{ fontSize: 20 }} />} aria-label="Galleri" />
            </Tabs>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            sx={{
              background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
              color: '#fff',
              fontWeight: 600,
              minHeight: TOUCH_TARGET_SIZE,
              boxShadow: '0 4px 12px rgba(147,51,234,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                boxShadow: '0 6px 16px rgba(147,51,234,0.4)',
              },
              ...focusVisibleStyles,
            }}
          >
            Nytt utstyr
          </Button>
          <Tooltip title="Utstyrs-maler">
            <Button
              variant="outlined"
              startIcon={<BookmarkIcon />}
              onClick={() => setTemplatesDialogOpen(true)}
              sx={{
                borderColor: '#4caf50',
                color: '#4caf50',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#66bb6a', bgcolor: 'rgba(76,175,80,0.1)' },
                ...focusVisibleStyles,
              }}
            >
              Maler
            </Button>
          </Tooltip>
          <Tooltip title="Rapporter">
            <Button
              variant="outlined"
              startIcon={<ReportIcon />}
              onClick={() => setReportsDialogOpen(true)}
              sx={{
                borderColor: '#9c27b0',
                color: '#9c27b0',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#ba68c8', bgcolor: 'rgba(156,39,176,0.1)' },
                ...focusVisibleStyles,
              }}
            >
              Rapporter
            </Button>
          </Tooltip>
          <Tooltip title={firmwareCheckedAt ? `Sist sjekket: ${new Date(firmwareCheckedAt).toLocaleString('nb-NO')}` : 'Sjekk firmware-oppdateringer'}>
            <Button
              variant="outlined"
              startIcon={firmwareChecking ? <CircularProgress size={16} sx={{ color: '#ff9800' }} /> : <RefreshIcon />}
              onClick={checkFirmwareUpdates}
              disabled={firmwareChecking}
              sx={{
                borderColor: '#ff9800',
                color: '#ff9800',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#ffb74d', bgcolor: 'rgba(255,152,0,0.1)' },
                ...focusVisibleStyles,
              }}
            >
              {firmwareChecking
                ? 'Sjekker firmware...'
                : `Firmware${Object.keys(firmwareUpdatesByEquipmentId).length > 0 ? ` (${Object.keys(firmwareUpdatesByEquipmentId).length})` : ''}`}
            </Button>
          </Tooltip>
          {firmwareUnmatchedCount > 0 && (
            <Tooltip title={`${firmwareUnmatchedCount} utstyr uten firmware-info i katalogen. Legg til firmware-versjon manuelt for å dele med alle brukere.`}>
              <Chip
                icon={<WarningIcon />}
                label={`${firmwareUnmatchedCount} mangler firmware`}
                size="small"
                sx={{ bgcolor: 'rgba(255,152,0,0.15)', color: '#ffb74d', borderColor: '#ff9800', border: '1px solid' }}
              />
            </Tooltip>
          )}
          {offlineQueueCount > 0 && (
            <Tooltip title={isOnline ? `${offlineQueueCount} ventende operasjoner — klikk for å synkronisere` : `Offline — ${offlineQueueCount} operasjoner i kø`}>
              <Button
                variant="outlined"
                startIcon={isOnline ? <SyncIcon /> : <OfflineIcon />}
                onClick={isOnline ? handleSyncOfflineQueue : () => setOfflineOutboxOpen(true)}
                sx={{
                  borderColor: isOnline ? '#9333ea' : '#f44336',
                  color: isOnline ? '#9333ea' : '#f44336',
                  minHeight: TOUCH_TARGET_SIZE,
                  animation: isOnline ? 'pulse 1.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.6 },
                    '100%': { opacity: 1 },
                  },
                  '&:hover': { bgcolor: isOnline ? 'rgba(147,51,234,0.1)' : 'rgba(244,67,54,0.1)' },
                  ...focusVisibleStyles,
                }}
              >
                {offlineQueueCount} i kø
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Kjøp utstyr via foto.no">
            <Button
              variant="outlined"
              startIcon={<ShoppingCartIcon />}
              onClick={handleOpenShopDialog}
              sx={{
                borderColor: '#2196f3',
                color: '#2196f3',
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { borderColor: '#42a5f5', bgcolor: 'rgba(33,150,243,0.1)' },
                ...focusVisibleStyles,
              }}
            >
              Kjøp
            </Button>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
          <Tooltip title="Eksporter til CSV">
            <IconButton
              onClick={handleExportCSV}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(76,175,80,0.15)', color: '#4caf50' },
              }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Importer fra CSV">
            <IconButton
              component="label"
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(33,150,243,0.15)', color: '#2196f3' },
              }}
            >
              <UploadIcon />
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={handleImportCSV}
              />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Bulk Actions Bar */}
        {selectedEquipmentIds.size > 0 && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            p: 1.5, 
            mt: 1.5,
            bgcolor: 'rgba(147,51,234,0.1)', 
            borderRadius: 2,
            border: '1px solid rgba(147,51,234,0.3)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckboxIcon sx={{ color: '#9333ea' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedEquipmentIds.size} valgt
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={toggleSelectAll}
              startIcon={<SelectAllIcon />}
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            >
              {selectedEquipmentIds.size === filteredEquipment.length ? 'Fjern alle' : 'Velg alle'}
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={() => handleBulkAction('status')}
              sx={{ color: '#9333ea', '&:hover': { bgcolor: 'rgba(147,51,234,0.15)' } }}
            >
              Endre status
            </Button>
            <Button
              size="small"
              startIcon={<PersonIcon />}
              onClick={() => handleBulkAction('assign')}
              sx={{ color: '#2196f3', '&:hover': { bgcolor: 'rgba(33,150,243,0.15)' } }}
            >
              Tilordne
            </Button>
            <Button
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => handleBulkAction('delete')}
              sx={{ color: '#f44336', '&:hover': { bgcolor: 'rgba(244,67,54,0.15)' } }}
            >
              Slett valgte
            </Button>
            <Button
              size="small"
              startIcon={<PlaylistAddIcon />}
              onClick={handleCreateTemplateFromEquipment}
              sx={{ color: '#4caf50', '&:hover': { bgcolor: 'rgba(76,175,80,0.15)' } }}
            >
              Lag mal
            </Button>
            <Button
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleExportCSV}
              sx={{ color: '#64b5f6', '&:hover': { bgcolor: 'rgba(100,181,246,0.15)' } }}
            >
              Eksporter utvalg
            </Button>
            <IconButton
              size="small"
              onClick={() => setSelectedEquipmentIds(new Set())}
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Quick Stats Bar */}
      {equipment.length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          mb: 3, 
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Tilgjengelig', value: equipment.filter(e => e.status === 'available').length, color: '#4caf50' },
            { label: 'I bruk', value: equipment.filter(e => e.status === 'in_use').length, color: '#2196f3' },
            { label: 'Vedlikehold', value: equipment.filter(e => e.status === 'maintenance').length, color: '#9333ea' },
            { label: 'Totalt', value: equipment.reduce((sum, e) => sum + (e.quantity || 1), 0), color: '#9c27b0' },
          ].map((stat) => (
            <Box
              key={stat.label}
              sx={{
                flex: '1 1 auto',
                minWidth: 120,
                p: 1.5,
                borderRadius: 2,
                bgcolor: `${stat.color}10`,
                border: `1px solid ${stat.color}30`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.2s',
                cursor: 'default',
                '&:hover': {
                  bgcolor: `${stat.color}20`,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: `${stat.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Typography variant="h5" sx={{ color: stat.color, fontWeight: 700 }}>
                  {stat.value}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                  {stat.label}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Collapse in={filterOpen}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2, 
          mb: 3,
          p: 2.5,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(10px)',
        }}>
          <TextField
            placeholder="Søk etter navn, merke, modell..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9333ea' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(0,0,0,0.2)',
                color: '#fff',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#9333ea' },
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Kategori</InputLabel>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              label="Kategori"
              sx={{ 
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' }
                }
              }}
            >
              <MenuItem value="all">Alle kategorier</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getCategoryColor(cat) }} />
                    {cat}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
              sx={{ 
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' }
                }
              }}
            >
              <MenuItem value="all">Alle statuser</MenuItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS_COLORS[value] }} />
                    {label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {(searchQuery || categoryFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="text"
              size="small"
              startIcon={<CancelIcon />}
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              sx={{ 
                color: 'rgba(255,255,255,0.87)',
                '&:hover': { color: '#f44336' },
              }}
            >
              Nullstill
            </Button>
          )}
        </Box>
      </Collapse>

      {viewMode === 'grid' ? (
        <Grid container spacing={2.5}>
          {filteredEquipment.length === 0 ? (
            <Grid xs={12}>
              <RoleRoomEmptyState
                iconSrc={equipPng}
                title="Ingen utstyr funnet"
                subtitle={searchQuery || categoryFilter !== 'all' || statusFilter !== 'all' 
                  ? 'Prøv å endre søkekriteriene' 
                  : 'Legg til ditt første utstyr for å komme i gang'}
                color="#9333ea"
                buttonLabel="Legg til utstyr"
                onAction={() => handleOpenDialog()}
              />
            </Grid>
          ) : (
            filteredEquipment.map((eq, index) => (
            <Grid xs={12} sm={6} md={4} lg={3} key={eq.id}>
              <Grow in timeout={200 + index * 50}>
              <Card sx={{
                bgcolor: 'rgba(28, 33, 40, 0.8)',
                backdropFilter: 'blur(10px)',
                border: selectedEquipmentIds.has(eq.id) 
                  ? '2px solid #9333ea' 
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                position: 'relative',
                '&:hover': {
                  borderColor: selectedEquipmentIds.has(eq.id) ? '#c084fc' : 'rgba(147,51,234,0.5)',
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(147,51,234,0.2)',
                },
              }}>
                {/* Selection checkbox */}
                <Box sx={{ 
                  position: 'absolute', 
                  top: 8, 
                  left: 8, 
                  zIndex: 10,
                }}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); toggleSelectEquipment(eq.id); }}
                    sx={{ 
                      bgcolor: selectedEquipmentIds.has(eq.id) ? '#9333ea' : 'rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(4px)',
                      '&:hover': { bgcolor: selectedEquipmentIds.has(eq.id) ? '#c084fc' : 'rgba(0,0,0,0.7)' },
                    }}
                  >
                    {selectedEquipmentIds.has(eq.id) 
                      ? <CheckboxIcon sx={{ fontSize: 18, color: '#fff' }} />
                      : <CheckboxOutlineIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.87)' }} />
                    }
                  </IconButton>
                </Box>
                {/* Equipment Image with overlay */}
                <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                  {eq.image_url ? (
                    <>
                      <CardMedia
                        component="img"
                        height="160"
                        image={eq.image_url}
                        alt={eq.name}
                        sx={{ 
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                          '&:hover': { transform: 'scale(1.05)' },
                        }}
                        onError={(e: SyntheticEvent<HTMLImageElement>) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Gradient overlay */}
                      <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '60%',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        pointerEvents: 'none',
                      }} />
                    </>
                  ) : (
                    <Box sx={{
                      height: 120,
                      background: `linear-gradient(135deg, ${getCategoryColor(eq.category)}15 0%, ${getCategoryColor(eq.category)}05 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      position: 'relative',
                    }}>
                      <ImageIcon sx={{ fontSize: 36, color: getCategoryColor(eq.category), opacity: 0.3 }} />
                      <BuildIcon sx={{ fontSize: 48, color: getCategoryColor(eq.category), opacity: 0.5 }} />
                    </Box>
                  )}
                  
                  {/* Status badge - positioned on image */}
                  <Chip
                    label={STATUS_LABELS[eq.status] || eq.status}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      bgcolor: STATUS_COLORS[eq.status] || '#666',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      backdropFilter: 'blur(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                  />
                  
                  {/* Quantity badge */}
                  {eq.quantity > 1 && (
                    <Chip
                      label={`×${eq.quantity}`}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 10,
                        left: 50,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        backdropFilter: 'blur(4px)',
                      }}
                    />
                  )}
                  
                  {/* Global equipment indicator */}
                  {eq.is_global && (
                    <Tooltip title="Globalt utstyr - tilgjengelig i alle prosjekter">
                      <Chip
                        icon={<PublicIcon sx={{ fontSize: '14px !important' }} />}
                        label="Global"
                        size="small"
                        sx={{
                          position: 'absolute',
                          bottom: 10,
                          left: 10,
                          bgcolor: 'rgba(33,150,243,0.8)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          backdropFilter: 'blur(4px)',
                          boxShadow: '0 2px 8px rgba(33,150,243,0.3)',
                          '& .MuiChip-icon': { color: '#fff' },
                        }}
                      />
                    </Tooltip>
                  )}
                  {!eq.is_global && eq.project_id && (
                    <Tooltip title="Prosjekt-spesifikt utstyr">
                      <LockIcon sx={{
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        fontSize: 16,
                        color: 'rgba(255,255,255,0.4)',
                      }} />
                    </Tooltip>
                  )}
                </Box>
                
                <CardContent sx={{ flex: 1, p: 2 }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 700, 
                    color: '#fff',
                    fontSize: isDesktop ? '1rem' : '0.95rem',
                    mb: 0.5,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {eq.name}
                  </Typography>
                  
                  {eq.brand && (
                    <Typography variant="body2" sx={{ 
                      color: 'rgba(255,255,255,0.87)', 
                      mb: 0.5,
                      fontSize: '0.8rem',
                    }}>
                      {eq.brand} {eq.model && `• ${eq.model}`}
                    </Typography>
                  )}

                  {/* Serial number with copy button */}
                  {eq.serial_number && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                        SN: {eq.serial_number}
                      </Typography>
                      <Tooltip title="Kopier serienummer">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(eq.serial_number || ''); showSuccess('Serienummer kopiert'); }}
                          sx={{ p: 0.25, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#9333ea' } }}
                        >
                          <CopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                  
                  <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                    {eq.category && (
                      <Chip 
                        label={eq.category} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(147,51,234,0.15)', 
                          color: '#c084fc', 
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          border: '1px solid rgba(147,51,234,0.2)',
                        }} 
                      />
                    )}
                    <Chip
                      icon={eq.condition === 'excellent' ? <StarIcon sx={{ fontSize: '14px !important' }} /> : undefined}
                      label={CONDITION_LABELS[eq.condition] || eq.condition}
                      size="small"
                      sx={{
                        bgcolor: `${(CONDITION_COLORS[eq.condition] || '#999')}20`,
                        color: CONDITION_COLORS[eq.condition] || '#999',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        border: `1px solid ${CONDITION_COLORS[eq.condition]}40`,
                        '& .MuiChip-icon': { color: CONDITION_COLORS[eq.condition] || '#999' },
                      }}
                    />
                    {eq.status === 'retired' && (
                      <Chip
                        icon={<BlockIcon sx={{ fontSize: '14px !important' }} />}
                        label="Utfaset"
                        size="small"
                        sx={{
                          bgcolor: 'rgba(158,158,158,0.15)',
                          color: '#9e9e9e',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          border: '1px solid rgba(158,158,158,0.3)',
                          '& .MuiChip-icon': { color: '#9e9e9e' },
                        }}
                      />
                    )}
                    {firmwareUpdatesByEquipmentId[eq.id] && (() => {
                      const fw = firmwareUpdatesByEquipmentId[eq.id];
                      const statusConfig = {
                        'up-to-date': { icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, label: 'Oppdatert', bg: 'rgba(76,175,80,0.2)', color: '#66bb6a', border: 'rgba(76,175,80,0.4)' },
                        'update-available': { icon: <WarningIcon sx={{ fontSize: 14 }} />, label: `FW ${fw.latestVersion || 'ny'}`, bg: 'rgba(255,152,0,0.2)', color: '#ffb74d', border: 'rgba(255,152,0,0.4)' },
                        'unknown': { icon: <OfflineIcon sx={{ fontSize: 14 }} />, label: 'Ukjent', bg: 'rgba(158,158,158,0.2)', color: '#bdbdbd', border: 'rgba(158,158,158,0.4)' },
                        'needs-mapping': { icon: <MissingItemIcon sx={{ fontSize: 14 }} />, label: 'Trenger kobling', bg: 'rgba(156,39,176,0.2)', color: '#ce93d8', border: 'rgba(156,39,176,0.4)' },
                      }[fw.status] || { icon: null, label: 'Firmware', bg: 'rgba(158,158,158,0.2)', color: '#bdbdbd', border: 'rgba(158,158,158,0.4)' };
                      const tooltipText = fw.status === 'update-available'
                        ? `Oppdatering: v${fw.latestVersion} (${fw.severity || 'recommended'})`
                        : fw.status === 'up-to-date'
                        ? `Firmware v${fw.currentVersion || fw.latestVersion} er oppdatert`
                        : fw.status === 'needs-mapping'
                        ? 'Kunne ikke matche modell – klikk for å koble'
                        : fw.message || 'Ingen firmware-informasjon';
                      return (
                        <Tooltip title={tooltipText}>
                          <Chip
                            icon={statusConfig.icon}
                            label={statusConfig.label}
                            size="small"
                            sx={{
                              bgcolor: statusConfig.bg,
                              color: statusConfig.color,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: `1px solid ${statusConfig.border}`,
                            }}
                          />
                        </Tooltip>
                      );
                    })()}
                    {firmwareUpdatesByEquipmentId[eq.id]?.downloadUrl && (
                      <Tooltip title={isScrapeBlocked(eq.brand || '') ? 'Åpne produsentens nedlastingsside' : 'Last ned firmware'}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); window.open(firmwareUpdatesByEquipmentId[eq.id].downloadUrl, '_blank'); }}
                          sx={{ p: 0.25, color: '#64b5f6' }}
                        >
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                  
                  {(eq.location_name || (eq.primary_location_id && getLocationName(eq.primary_location_id))) && (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 0.75, 
                      mb: 1,
                      p: 0.75,
                      borderRadius: 1.5,
                      bgcolor: 'rgba(33,150,243,0.08)',
                      border: '1px solid rgba(33,150,243,0.15)',
                    }}>
                      <LocationIcon sx={{ fontSize: 16, color: '#64b5f6' }} />
                      <Typography variant="body2" sx={{ color: '#90caf9', fontSize: '0.75rem' }}>
                        {eq.location_name || getLocationName(eq.primary_location_id || '')}
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Date info indicator */}
                  {eq.created_at && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                        Lagt til: {new Date(eq.created_at).toLocaleDateString('nb-NO')}
                        {eq.updated_at && eq.updated_at !== eq.created_at
                          ? ` • Oppdatert: ${new Date(eq.updated_at).toLocaleDateString('nb-NO')}`
                          : ''}
                      </Typography>
                    </Box>
                  )}

                  {/* Firmware download link indicator */}
                  {firmwareUpdatesByEquipmentId[eq.id]?.downloadUrl && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                      <LinkIcon sx={{ fontSize: 14, color: '#64b5f6' }} />
                      <Typography
                        variant="caption"
                        component="a"
                        href={firmwareUpdatesByEquipmentId[eq.id].downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        sx={{
                          color: '#64b5f6',
                          fontSize: '0.7rem',
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        Firmware nedlasting
                      </Typography>
                    </Box>
                  )}

                  {eq.assignees && eq.assignees.length > 0 && (
                    <Box sx={{ mt: 'auto' }}>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {eq.assignees.slice(0, 2).map((a, idx) => (
                          <Chip
                            key={idx}
                            label={getCrewName(a.crew_id)}
                            size="small"
                            icon={<PersonIcon sx={{ fontSize: 12 }} />}
                            onDelete={() => handleUnassign(eq.id, a.crew_id)}
                            sx={{ 
                              bgcolor: 'rgba(33, 150, 243, 0.15)', 
                              color: '#64b5f6', 
                              fontSize: '0.65rem',
                              height: 24,
                              '& .MuiChip-deleteIcon': { fontSize: 14, color: '#64b5f6' },
                            }}
                          />
                        ))}
                        {eq.assignees.length > 2 && (
                          <Chip
                            label={`+${eq.assignees.length - 2}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.65rem', height: 24 }}
                          />
                        )}
                      </Stack>
                    </Box>
                  )}
                </CardContent>
                
                {/* Action buttons with glass effect */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  p: 1.5, 
                  pt: 1,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  bgcolor: 'rgba(0,0,0,0.2)',
                }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Bookinger">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenBookings(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
                        }}
                      >
                        <ScheduleIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    {eq.status === 'in_use' ? (
                      <Tooltip title="Lever inn">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenCheckin(eq)}
                          sx={{
                            ...focusVisibleStyles,
                            color: '#4caf50',
                            bgcolor: 'rgba(76,175,80,0.12)',
                            '&:hover': { bgcolor: 'rgba(76,175,80,0.2)' },
                          }}
                        >
                          <CheckInIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    ) : eq.status === 'available' ? (
                      <Tooltip title="Sjekk ut">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenCheckout(eq)}
                          sx={{
                            ...focusVisibleStyles,
                            color: '#2196f3',
                            '&:hover': { bgcolor: 'rgba(33,150,243,0.1)' },
                          }}
                        >
                          <CheckOutIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <Tooltip title="Tilordne ansvarlig">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenAssign(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#2196f3', bgcolor: 'rgba(33,150,243,0.1)' },
                        }}
                      >
                        <PersonIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="QR-kode">
                      <IconButton
                        size="small"
                        onClick={() => handlePrintQR(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#9c27b0', bgcolor: 'rgba(156,39,176,0.1)' },
                        }}
                      >
                        <QrCodeIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Historikk">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenHistory(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#673ab7', bgcolor: 'rgba(103,58,183,0.1)' },
                        }}
                      >
                        <HistoryIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Dupliser">
                      <IconButton
                        size="small"
                        onClick={() => handleDuplicate(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#00bcd4', bgcolor: 'rgba(0,188,212,0.1)' },
                        }}
                      >
                        <DuplicateIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Vedlikehold">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenMaintenance(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#009688', bgcolor: 'rgba(0,150,136,0.1)' },
                        }}
                      >
                        <BuildIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Rediger">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                        }}
                      >
                        <EditIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Slett">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(eq)}
                        sx={{ 
                          ...focusVisibleStyles, 
                          color: 'rgba(255,255,255,0.87)',
                          '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)' },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Card>
              </Grow>
            </Grid>
          )))}
        </Grid>
      ) : viewMode === 'gallery' ? (
        /* Gallery view using ImageList for visual browsing */
        <ImageList
          cols={isDesktop ? 4 : isTablet ? 3 : isMobile ? 1 : 2}
          gap={16}
          sx={{ mt: 0, overflow: 'visible' }}
        >
          {filteredEquipment.length === 0 ? (
            <ImageListItem cols={isDesktop ? 4 : isTablet ? 3 : isMobile ? 1 : 2}>
              <RoleRoomEmptyState
                iconSrc={equipPng}
                title="Ingen utstyr funnet"
                subtitle={searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Prøv å endre søkekriteriene'
                  : 'Legg til ditt første utstyr for å komme i gang'}
                color="#9333ea"
                buttonLabel="Legg til utstyr"
                onAction={() => handleOpenDialog()}
              />
            </ImageListItem>
          ) : (
            filteredEquipment.map((eq) => (
              <ImageListItem
                key={eq.id}
                onClick={() => handlePreviewEquipment(eq)}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: selectedEquipmentIds.has(eq.id)
                    ? '2px solid #9333ea'
                    : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'rgba(147,51,234,0.5)',
                    transform: 'scale(1.02)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  },
                }}
              >
                {eq.image_url ? (
                  <img
                    src={eq.image_url}
                    alt={eq.name}
                    loading="lazy"
                    style={{ height: 220, objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{
                    height: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: `${getCategoryColor(eq.category)}15`,
                  }}>
                    <BuildIcon sx={{ fontSize: 64, color: getCategoryColor(eq.category), opacity: 0.4 }} />
                  </Box>
                )}
                <ImageListItemBar
                  title={eq.name}
                  subtitle={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      {eq.brand && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          {eq.brand} {eq.model && `• ${eq.model}`}
                        </Typography>
                      )}
                      <Box sx={{
                        width: 8, height: 8, borderRadius: '50%',
                        bgcolor: STATUS_COLORS[eq.status] || '#666',
                        flexShrink: 0,
                      }} />
                    </Box>
                  }
                  actionIcon={
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); handleOpenDialog(eq); }}
                      sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#c084fc' } }}
                    >
                      <EditIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  }
                  sx={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
                    '& .MuiImageListItemBar-title': { fontWeight: 600, fontSize: '0.9rem' },
                  }}
                />
              </ImageListItem>
            ))
          )}
        </ImageList>
      ) : (
        <TableContainer component={Paper} sx={{ 
          bgcolor: 'rgba(28, 33, 40, 0.8)', 
          backdropFilter: 'blur(10px)',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <Table>
            <TableHead>
              <TableRow sx={{ 
                background: 'linear-gradient(135deg, rgba(147,51,234,0.1) 0%, rgba(109,40,217,0.05) 100%)',
              }}>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#9333ea' }, '& .MuiTableSortLabel-icon': { color: '#9333ea !important' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <TableSortLabel
                    active={sortField === 'category'}
                    direction={sortField === 'category' ? sortDirection : 'asc'}
                    onClick={() => handleSort('category')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#9333ea' }, '& .MuiTableSortLabel-icon': { color: '#9333ea !important' } }}
                  >
                    Kategori
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Merke/Modell</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#9333ea' }, '& .MuiTableSortLabel-icon': { color: '#9333ea !important' } }}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Tilstand</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }} align="center">Antall</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Lokasjon</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }} align="right">Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEquipment.map((eq, index) => (
                <TableRow 
                  key={eq.id} 
                  aria-label={`Utstyrsrad ${index + 1}`}
                  sx={{ 
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(147,51,234,0.05)' },
                    '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <TableCell sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {eq.image_url ? (
                        <Box 
                          component="img" 
                          src={eq.image_url} 
                          sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: 1.5, 
                            objectFit: 'cover',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }} 
                        />
                      ) : (
                        <Box sx={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 1.5, 
                          bgcolor: `${getCategoryColor(eq.category)}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <BuildIcon sx={{ fontSize: 20, color: getCategoryColor(eq.category) }} />
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {eq.name}
                          {eq.is_global && (
                            <Tooltip title="Globalt utstyr - tilgjengelig i alle prosjekter">
                              <PublicIcon sx={{ fontSize: 16, color: '#2196f3' }} />
                            </Tooltip>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Chip 
                      label={eq.category || '-'} 
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(147,51,234,0.1)', 
                        color: '#c084fc',
                        fontSize: '0.75rem',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {eq.brand || eq.model ? `${eq.brand || ''} ${eq.model || ''}`.trim() : '-'}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip
                        label={STATUS_LABELS[eq.status] || eq.status}
                        size="small"
                        sx={{ 
                          bgcolor: `${STATUS_COLORS[eq.status]}20`, 
                          color: STATUS_COLORS[eq.status], 
                          fontWeight: 600,
                          border: `1px solid ${STATUS_COLORS[eq.status]}40`,
                        }}
                      />
                      {firmwareUpdatesByEquipmentId[eq.id] && (() => {
                        const fw = firmwareUpdatesByEquipmentId[eq.id];
                        const cfg = {
                          'up-to-date': { icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, label: 'FW OK', bg: 'rgba(76,175,80,0.2)', color: '#66bb6a', border: 'rgba(76,175,80,0.4)' },
                          'update-available': { icon: <WarningIcon sx={{ fontSize: 14 }} />, label: `FW ${fw.latestVersion || 'ny'}`, bg: 'rgba(255,152,0,0.2)', color: '#ffb74d', border: 'rgba(255,152,0,0.4)' },
                          'unknown': { icon: <OfflineIcon sx={{ fontSize: 14 }} />, label: 'FW ?', bg: 'rgba(158,158,158,0.2)', color: '#bdbdbd', border: 'rgba(158,158,158,0.4)' },
                          'needs-mapping': { icon: <MissingItemIcon sx={{ fontSize: 14 }} />, label: 'Koble', bg: 'rgba(156,39,176,0.2)', color: '#ce93d8', border: 'rgba(156,39,176,0.4)' },
                        }[fw.status] || { icon: null, label: 'FW', bg: 'rgba(158,158,158,0.2)', color: '#bdbdbd', border: 'rgba(158,158,158,0.4)' };
                        return (
                          <Chip
                            icon={cfg.icon}
                            label={cfg.label}
                            size="small"
                            sx={{ bgcolor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                          />
                        );
                      })()}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Chip
                      label={CONDITION_LABELS[eq.condition] || eq.condition}
                      size="small"
                      sx={{ 
                        bgcolor: `${CONDITION_COLORS[eq.condition]}20`, 
                        color: CONDITION_COLORS[eq.condition],
                        border: `1px solid ${CONDITION_COLORS[eq.condition]}40`,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Chip 
                      label={eq.quantity} 
                      size="small" 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.1)', 
                        color: '#fff',
                        fontWeight: 700,
                        minWidth: 32,
                      }} 
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {(eq.location_name || (eq.primary_location_id && getLocationName(eq.primary_location_id))) ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationIcon sx={{ fontSize: 14, color: '#64b5f6' }} />
                        <Typography variant="body2" sx={{ color: '#90caf9' }}>
                          {eq.location_name || getLocationName(eq.primary_location_id || '')}
                        </Typography>
                      </Box>
                    ) : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Bookinger">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenBookings(eq)} 
                          sx={{ 
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
                          }}
                        >
                          <ScheduleIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      {eq.status === 'in_use' ? (
                        <Tooltip title="Lever inn">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCheckin(eq)}
                            sx={{ ...focusVisibleStyles, color: '#4caf50', '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' } }}
                          >
                            <CheckInIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      ) : eq.status === 'available' ? (
                        <Tooltip title="Sjekk ut">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCheckout(eq)}
                            sx={{ ...focusVisibleStyles, color: '#2196f3', '&:hover': { bgcolor: 'rgba(33,150,243,0.1)' } }}
                          >
                            <CheckOutIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      <Tooltip title="Tilordne">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenAssign(eq)} 
                          sx={{ 
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#2196f3', bgcolor: 'rgba(33,150,243,0.1)' },
                          }}
                        >
                          <PersonIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(eq)} 
                          sx={{ 
                            ...focusVisibleStyles,
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                          }}
                        >
                          <EditIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteClick(eq)} 
                          sx={{ 
                            ...focusVisibleStyles, 
                            color: 'rgba(255,255,255,0.87)',
                            '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)' },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Scene Equipment Advisor */}
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <MovieIcon sx={{ fontSize: 24, color: '#c084fc' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>
          Scene-utstyrsrådgiver
        </Typography>
      </Box>
      <SceneEquipmentAdvisor projectId={projectId} />

      {/* Equipment Intelligence Engines */}
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <CalendarTodayIcon sx={{ fontSize: 24, color: '#c084fc' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>
          Utstyrsintelligens
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b', ml: 1 }}>
          Prediktiv analyse · Kompatibilitet · Vektsimulering · Stilprofil
        </Typography>
      </Box>
      <EquipmentIntelligence projectId={projectId} />

      {/* Quick Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(28, 33, 40, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(147,51,234,0.2)',
            borderRadius: 3,
          },
        }}
      >
        {previewEquipment && (
          <>
            <DialogTitle sx={{
              color: '#fff',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <BuildIcon sx={{ color: '#9333ea' }} />
              {previewEquipment.name}
            </DialogTitle>
            <DialogContent sx={{ mt: 2 }}>
              {previewEquipment.image_url && (
                <Box sx={{
                  mb: 2,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <img
                    src={previewEquipment.image_url}
                    alt={previewEquipment.name}
                    style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }}
                  />
                </Box>
              )}
              <Stack spacing={1.5}>
                {previewEquipment.brand && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>Merke / Modell</Typography>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                      {previewEquipment.brand} {previewEquipment.model && `• ${previewEquipment.model}`}
                    </Typography>
                  </Box>
                )}
                {previewEquipment.serial_number && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>Serienummer</Typography>
                    <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'monospace' }}>{previewEquipment.serial_number}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>Status</Typography>
                  <Chip label={STATUS_LABELS[previewEquipment.status] || previewEquipment.status} size="small" sx={{ bgcolor: STATUS_COLORS[previewEquipment.status], color: '#fff', fontWeight: 600 }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>Tilstand</Typography>
                  <Chip
                    icon={previewEquipment.condition === 'excellent' ? <StarIcon sx={{ fontSize: '14px !important' }} /> : undefined}
                    label={CONDITION_LABELS[previewEquipment.condition] || previewEquipment.condition}
                    size="small"
                    sx={{
                      bgcolor: `${CONDITION_COLORS[previewEquipment.condition]}20`,
                      color: CONDITION_COLORS[previewEquipment.condition],
                      fontWeight: 600,
                      '& .MuiChip-icon': { color: CONDITION_COLORS[previewEquipment.condition] },
                    }}
                  />
                </Box>
                {previewEquipment.category && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>Kategori</Typography>
                    <Typography variant="body2" sx={{ color: '#c084fc', fontWeight: 600 }}>{previewEquipment.category}</Typography>
                  </Box>
                )}
                {previewEquipment.notes && (
                  <Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>Notater</Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', whiteSpace: 'pre-wrap' }}>
                      {previewEquipment.notes}
                    </Typography>
                  </Box>
                )}
                {previewEquipment.firmware_current && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>Firmware</Typography>
                    <Typography variant="body2" sx={{ color: '#66bb6a', fontFamily: 'monospace' }}>v{previewEquipment.firmware_current}</Typography>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 1.5 }}>
              <Button
                onClick={() => { setPreviewOpen(false); handleOpenDialog(previewEquipment); }}
                startIcon={<EditIcon />}
                sx={{ color: '#c084fc' }}
              >
                Rediger
              </Button>
              <Button onClick={() => setPreviewOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}>
                Lukk
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialogs extracted to EquipmentPanelDialogs.tsx */}
      <EquipmentPanelDialogs />

    </Box>
    </EquipmentPanelProvider>
  );
}

export default EquipmentManagementPanel;
