import { useState, useMemo, useEffect, useId, useRef, useCallback, type ChangeEvent, type DragEvent, type SyntheticEvent } from 'react';
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
type ViewMode = 'grid' | 'table';

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
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import equipPng from './icons/Keep/roleroom_equip.png';

interface EquipmentManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
}

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
    type: 'routine' as 'routine' | 'repair' | 'calibration' | 'cleaning',
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
      setNewCategoryName('');
      setNewCategoryDialogOpen(false);
      showSuccess(`Kategori "${newCategoryName.trim()}" lagt til`);
    }
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

  const loadVendorLinks = async () => {
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
  };

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
      setImagePickerOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSearchImage = (imageUrl: string) => {
    setFormData({ ...formData, imageUrl });
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
    loadVendorLinks();
    setShopDialogOpen(true);
  };

  const handleOpenDialog = (eq?: Equipment) => {
    if (eq) {
      setEditingEquipment(eq);
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
        isGlobal: eq.is_global || !eq.project_id, // Global if no project_id or is_global flag
      });
    } else {
      setEditingEquipment(null);
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
    } catch (error) {
      console.error('Error saving equipment:', error);
      showError('Kunne ikke lagre utstyr');
    }
  };

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
    const equipmentCats = new Set(equipment.map(eq => eq.category).filter(Boolean));
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

  return (
    <Box sx={{ p: containerPadding }}>
      {loading && <LinearProgress sx={{ mb: 2, bgcolor: 'rgba(147,51,234,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#9333ea' } }} />}
      
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
          <Tooltip title={viewMode === 'grid' ? 'Tabellvisning' : 'Rutenettvisning'}>
            <IconButton
              onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
              sx={{ 
                ...focusVisibleStyles, 
                minWidth: TOUCH_TARGET_SIZE, 
                minHeight: TOUCH_TARGET_SIZE,
                bgcolor: 'rgba(255,255,255,0.05)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              {viewMode === 'grid' ? <TableViewIcon /> : <GridViewIcon />}
            </IconButton>
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
            <Grid size={{ xs: 12 }}>
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
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={eq.id}>
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
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      position: 'relative',
                    }}>
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
                      mb: 1.5,
                      fontSize: '0.8rem',
                    }}>
                      {eq.brand} {eq.model && `• ${eq.model}`}
                    </Typography>
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
                      label={CONDITION_LABELS[eq.condition] || eq.condition}
                      size="small"
                      sx={{
                        bgcolor: `${CONDITION_COLORS[eq.condition]}20` || 'rgba(100,100,100,0.2)',
                        color: CONDITION_COLORS[eq.condition] || '#999',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        border: `1px solid ${CONDITION_COLORS[eq.condition]}40`,
                      }}
                    />
                  </Stack>
                  
                  {eq.location_name && (
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
                        {eq.location_name}
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
                    {eq.location_name ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationIcon sx={{ fontSize: 14, color: '#64b5f6' }} />
                        <Typography variant="body2" sx={{ color: '#90caf9' }}>{eq.location_name}</Typography>
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

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle id={dialogTitleId} sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(109,40,217,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(147,51,234,0.3)',
            }}>
              <BuildIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {editingEquipment ? 'Rediger utstyr' : 'Legg til nytt utstyr'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {editingEquipment ? 'Oppdater informasjon om utstyret' : 'Fyll inn detaljer for det nye utstyret'}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Navn *"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                }}
                error={!!formErrors.name}
                helperText={formErrors.name}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: formErrors.name ? '#f44336' : 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: formErrors.name ? '#f44336' : 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: formErrors.name ? '#f44336' : '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: formErrors.name ? '#f44336' : 'rgba(255,255,255,0.6)' },
                  '& .MuiFormHelperText-root': { color: '#f44336' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Kategori</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setNewCategoryDialogOpen(true);
                    } else {
                      setFormData({ ...formData, category: e.target.value });
                    }
                  }}
                  label="Kategori"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 350 } }
                  }}
                >
                  {allCategories.map(cat => (
                    <MenuItem key={cat} value={cat}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getCategoryColor(cat) }} />
                          {cat}
                        </Box>
                        {customCategories.includes(cat) && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustomCategory(cat);
                            }}
                            sx={{ 
                              p: 0.5, 
                              color: 'rgba(255,255,255,0.87)', 
                              '&:hover': { color: '#f44336' } 
                            }}
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                  <MenuItem value="__add_new__" sx={{ color: '#4caf50' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon sx={{ fontSize: 18 }} />
                      Legg til ny kategori...
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Merke"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Modell"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Serienummer"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Antall"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                inputProps={{ min: 1 }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Equipment['status'] })}
                  label="Status"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
                  }}
                >
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
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Tilstand</InputLabel>
                <Select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as Equipment['condition'] })}
                  label="Tilstand"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
                  }}
                >
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CONDITION_COLORS[value] }} />
                        {label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Lagerlokasjon</InputLabel>
                <Select
                  value={formData.primaryLocationId}
                  onChange={(e) => setFormData({ ...formData, primaryLocationId: e.target.value })}
                  label="Lagerlokasjon"
                  sx={{ 
                    color: '#fff', 
                    bgcolor: 'rgba(0,0,0,0.2)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                  }}
                  MenuProps={{
                    PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
                  }}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {locations.map(loc => (
                    <MenuItem key={loc.id} value={loc.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon sx={{ fontSize: 16, color: '#64b5f6' }} />
                        {loc.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Beskrivelse"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Notater"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                multiline
                rows={2}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(0,0,0,0.2)', 
                    color: '#fff',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(147,51,234,0.3)' },
                    '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Grid>
            
            {/* Global Equipment Toggle */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: formData.isGlobal ? 'rgba(33,150,243,0.1)' : 'rgba(0,0,0,0.2)',
                border: formData.isGlobal ? '1px solid rgba(33,150,243,0.3)' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                    Globalt utstyr
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {formData.isGlobal 
                      ? 'Tilgjengelig i alle prosjekter' 
                      : 'Kun tilknyttet dette prosjektet'}
                  </Typography>
                </Box>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => setFormData({ ...formData, isGlobal: !formData.isGlobal })}
                >
                  <Typography variant="body2" sx={{ color: formData.isGlobal ? '#2196f3' : 'rgba(255,255,255,0.5)' }}>
                    {formData.isGlobal ? 'Ja' : 'Nei'}
                  </Typography>
                  <Box sx={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    bgcolor: formData.isGlobal ? '#2196f3' : 'rgba(255,255,255,0.2)',
                    position: 'relative',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}>
                    <Box sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      bgcolor: '#fff',
                      position: 'absolute',
                      top: 2,
                      left: formData.isGlobal ? 24 : 2,
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }} />
                  </Box>
                </Box>
              </Box>
            </Grid>
            
            {/* Image Picker Section with Drag & Drop */}
            <Grid size={{ xs: 12 }}>
              <Box 
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: isDragging ? 'rgba(147,51,234,0.1)' : 'rgba(0,0,0,0.2)',
                  border: isDragging ? '2px dashed #9333ea' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s',
                }}
              >
                <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  Utstyrsbilde
                  {isDragging && <Chip label="Slipp bildet her!" size="small" sx={{ bgcolor: '#9333ea', color: '#fff', fontSize: '0.7rem' }} />}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  {/* Image Preview */}
                  <Box sx={{
                    width: 140,
                    height: 100,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius: 2,
                    border: isDragging ? '2px solid #9333ea' : '2px dashed rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: 'rgba(147,51,234,0.3)',
                    },
                  }}>
                    {formData.imageUrl ? (
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                      />
                    ) : (
                    <ImageIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.2)' }} />
                    )}
                  </Box>
                
                  {/* Image Actions */}
                  <Stack spacing={1.5} sx={{ flex: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SearchIcon />}
                      onClick={() => {
                        setImagePickerOpen(true);
                        setImagePickerTab(0);
                        setImageSearchQuery(formData.name || formData.category || '');
                      }}
                      sx={{ 
                        borderColor: 'rgba(147,51,234,0.5)', 
                        color: '#9333ea',
                        borderRadius: 2,
                        py: 1,
                        justifyContent: 'flex-start',
                        '&:hover': { borderColor: '#9333ea', bgcolor: 'rgba(147,51,234,0.1)' },
                      }}
                    >
                      Søk bilder
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudUploadIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      sx={{ 
                        borderColor: 'rgba(76,175,80,0.5)', 
                        color: '#4caf50',
                        borderRadius: 2,
                        py: 1,
                        justifyContent: 'flex-start',
                        '&:hover': { borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                      }}
                    >
                      Last opp fil
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <TextField
                      size="small"
                      placeholder="Eller lim inn bilde-URL..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        endAdornment: formData.imageUrl && (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              onClick={() => setFormData({ ...formData, imageUrl: '' })}
                              sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#f44336' } }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        '& .MuiOutlinedInput-root': { 
                          bgcolor: 'rgba(0,0,0,0.2)', 
                          color: '#fff',
                          borderRadius: 2,
                          '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                        },
                      }}
                    />
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => setDialogOpen(false)}
            startIcon={<CancelIcon />}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE, 
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              ...focusVisibleStyles,
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              background: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
              color: '#000',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 4,
              boxShadow: '0 4px 14px rgba(147,51,234,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)',
                boxShadow: '0 6px 20px rgba(147,51,234,0.4)',
              },
              ...focusVisibleStyles,
            }}
          >
            {editingEquipment ? 'Oppdater' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(30,136,229,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33,150,243,0.3)',
            }}>
              <PersonIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Tilordne utstyrsansvarlig
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Velg hvem som skal ha ansvar for utstyret
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setAssignDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Box sx={{ 
            p: 2, 
            mb: 2.5, 
            borderRadius: 2, 
            bgcolor: 'rgba(33,150,243,0.08)',
            border: '1px solid rgba(33,150,243,0.2)',
          }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Valgt utstyr: <strong style={{ color: '#fff' }}>{selectedEquipmentForAssign?.name}</strong>
            </Typography>
          </Box>
          <FormControl fullWidth>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Velg teammedlem</InputLabel>
            <Select
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              label="Velg teammedlem"
              sx={{ 
                color: '#fff', 
                bgcolor: 'rgba(0,0,0,0.2)',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(33,150,243,0.3)' },
              }}
              MenuProps={{
                PaperProps: { sx: { bgcolor: '#1c2128', border: '1px solid rgba(255,255,255,0.1)' } }
              }}
            >
              {crewMembers.map(crew => (
                <MenuItem key={crew.id} value={crew.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'rgba(33,150,243,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <PersonIcon sx={{ fontSize: 16, color: '#2196f3' }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{crew.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{crew.role}</Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => setAssignDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleAssign}
            variant="contained"
            disabled={!selectedCrewId}
            sx={{
              background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
              color: '#fff',
              fontWeight: 700,
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 4,
              boxShadow: '0 4px 14px rgba(33,150,243,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)',
                boxShadow: '0 6px 20px rgba(33,150,243,0.4)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.87)',
              },
            }}
          >
            Tilordne
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bookingsDialogOpen}
        onClose={() => setBookingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
            }}>
              <ScheduleIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Bookinger
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {selectedEquipmentBookings?.name}
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setBookingsDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          {bookings.length === 0 && availability.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'rgba(255,255,255,0.87)' }}>
              <Box sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(76,175,80,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50' }} />
              </Box>
              <Typography sx={{ fontWeight: 500 }}>Ingen aktive bookinger eller blokkeringer</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>Dette utstyret er tilgjengelig for booking</Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {bookings.map(booking => (
                <Box key={booking.id} sx={{ 
                  p: 2.5, 
                  bgcolor: 'rgba(33, 150, 243, 0.08)', 
                  borderRadius: 2,
                  border: '1px solid rgba(33, 150, 243, 0.2)',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.12)' },
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {booking.purpose || 'Booking'}
                    </Typography>
                    <Chip
                      label={booking.status}
                      size="small"
                      sx={{ 
                        bgcolor: booking.status === 'confirmed' ? '#4caf50' : '#9333ea',
                        color: '#fff',
                        fontWeight: 600,
                        borderRadius: 1.5,
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                    {booking.start_date} - {booking.end_date}
                  </Typography>
                </Box>
              ))}
              {availability.map(avail => (
                <Box key={avail.id} sx={{ 
                  p: 2.5, 
                  bgcolor: avail.status === 'service' ? 'rgba(147, 51, 234, 0.08)' : 'rgba(244, 67, 54, 0.08)', 
                  borderRadius: 2,
                  border: `1px solid ${avail.status === 'service' ? 'rgba(147, 51, 234, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
                  transition: 'all 0.2s',
                  '&:hover': { 
                    bgcolor: avail.status === 'service' ? 'rgba(147, 51, 234, 0.12)' : 'rgba(244, 67, 54, 0.12)',
                  },
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {avail.status === 'service' ? (
                        <WarningIcon sx={{ color: '#9333ea' }} />
                      ) : (
                        <BlockIcon sx={{ color: '#f44336' }} />
                      )}
                      <Typography sx={{ fontWeight: 600 }}>
                        {avail.status === 'service' ? 'Service' : 'Utilgjengelig'}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                    {avail.start_date} - {avail.end_date}
                  </Typography>
                  {avail.reason && (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 0.5 }}>
                      Grunn: {avail.reason}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            startIcon={<AddIcon />}
            onClick={handleOpenCreateBooking}
            sx={{ 
              color: '#2196f3',
              borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(33,150,243,0.1)' },
            }}
          >
            Ny booking
          </Button>
          <Button
            onClick={() => setBookingsDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={templatesDialogOpen}
        onClose={() => setTemplatesDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
            }}>
              <BookmarkIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Utstyrs-maler</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Forhåndsdefinerte utstyrssett
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setTemplatesDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          {templates.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, color: 'rgba(255,255,255,0.87)' }}>
              <Box sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(76,175,80,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}>
                <BookmarkIcon sx={{ fontSize: 36, opacity: 0.5 }} />
              </Box>
              <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>Ingen maler ennå</Typography>
              <Typography variant="body2" sx={{ mb: 3 }}>
                {selectedEquipmentIds.size > 0 
                  ? `${selectedEquipmentIds.size} utstyr valgt - klikk for å lage mal` 
                  : 'Velg utstyr med checkboxer, eller lag mal fra alt'}
              </Typography>
              {equipment.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<CopyIcon />}
                  onClick={handleCreateTemplateFromEquipment}
                  sx={{ 
                    borderColor: 'rgba(76,175,80,0.5)', 
                    color: '#4caf50',
                    borderRadius: 2,
                    '&:hover': { borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                  }}
                >
                  {selectedEquipmentIds.size > 0 
                    ? `Lag mal fra ${selectedEquipmentIds.size} valgte` 
                    : 'Lag mal fra alt utstyr'}
                </Button>
              )}
            </Box>
          ) : (
            <Stack spacing={2}>
              {templates.map(template => (
                <Card key={template.id} sx={{ 
                  bgcolor: template.is_global ? 'rgba(33,150,243,0.08)' : 'rgba(0,0,0,0.2)', 
                  border: template.is_global 
                    ? '1px solid rgba(33,150,243,0.3)' 
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': { 
                    bgcolor: template.is_global ? 'rgba(33,150,243,0.12)' : 'rgba(0,0,0,0.3)',
                    borderColor: template.is_global ? 'rgba(33,150,243,0.5)' : 'rgba(76,175,80,0.3)',
                  },
                }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {template.is_global && (
                            <Tooltip title="Global mal - tilgjengelig i alle prosjekter">
                              <PublicIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                            </Tooltip>
                          )}
                          {template.name}
                          {template.is_default && (
                            <StarIcon sx={{ color: '#9333ea', fontSize: 18 }} />
                          )}
                        </Typography>
                        {template.description && (
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 0.5 }}>
                            {template.description}
                          </Typography>
                        )}
                        {/* Show project association info */}
                        <Typography variant="caption" sx={{ 
                          color: template.is_global ? '#2196f3' : 'rgba(255,255,255,0.4)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          mt: 0.5,
                        }}>
                          {template.is_global ? (
                            <>
                              <PublicIcon sx={{ fontSize: 12 }} />
                              Tilgjengelig i alle prosjekter
                            </>
                          ) : (
                            <>
                              <LockIcon sx={{ fontSize: 12 }} />
                              Kun dette prosjektet
                            </>
                          )}
                        </Typography>
                      </Box>
                      <Chip 
                        label={`${template.item_count || 0} elementer`} 
                        size="small" 
                        sx={{ 
                          bgcolor: 'rgba(76,175,80,0.15)', 
                          color: '#4caf50',
                          fontWeight: 600,
                          borderRadius: 1.5,
                        }} 
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                      {template.is_global && (
                        <Chip 
                          icon={<PublicIcon sx={{ fontSize: '14px !important' }} />} 
                          label="Global" 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(33,150,243,0.15)', 
                            color: '#2196f3',
                            borderRadius: 1,
                            '& .MuiChip-icon': { color: '#2196f3' },
                          }} 
                        />
                      )}
                      {template.category && (
                        <Chip label={template.category} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', borderRadius: 1 }} />
                      )}
                      {template.use_case && (
                        <Chip label={template.use_case} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', borderRadius: 1 }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlaylistAddIcon />}
                        onClick={() => handleApplyTemplate(template.id)}
                        sx={{ 
                          background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
                          color: '#fff', 
                          borderRadius: 1.5,
                          fontWeight: 600,
                          '&:hover': { background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)' },
                        }}
                      >
                        Bruk mal
                      </Button>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteTemplate(template.id)}
                        sx={{ 
                          color: 'rgba(244,67,54,0.7)',
                          '&:hover': { color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)' },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          {equipment.length > 0 && (
            <Button
              startIcon={<CopyIcon />}
              onClick={handleCreateTemplateFromEquipment}
              sx={{ 
                color: '#4caf50',
                borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' },
              }}
            >
              {selectedEquipmentIds.size > 0 
                ? `Lag mal fra ${selectedEquipmentIds.size} valgte` 
                : 'Lag mal fra alt utstyr'}
            </Button>
          )}
          <Button
            onClick={() => setTemplatesDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Form Dialog - for creating/editing templates */}
      <Dialog
        open={templateFormOpen}
        onClose={() => setTemplateFormOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BookmarkIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {editingTemplate ? 'Rediger mal' : 'Opprett mal'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {templateFormData.items.length} elementer
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Navn på mal"
              value={templateFormData.name}
              onChange={e => setTemplateFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              sx={{ 
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiOutlinedInput-input': { color: '#fff' },
              }}
            />
            <TextField
              label="Beskrivelse"
              value={templateFormData.description}
              onChange={e => setTemplateFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              sx={{ 
                '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiOutlinedInput-input': { color: '#fff' },
              }}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Kategori"
                  value={templateFormData.category}
                  onChange={e => setTemplateFormData(prev => ({ ...prev, category: e.target.value }))}
                  fullWidth
                  sx={{ 
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiOutlinedInput-input': { color: '#fff' },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Bruksområde"
                  value={templateFormData.use_case}
                  onChange={e => setTemplateFormData(prev => ({ ...prev, use_case: e.target.value }))}
                  fullWidth
                  sx={{ 
                    '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' },
                    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                    '& .MuiOutlinedInput-input': { color: '#fff' },
                  }}
                />
              </Grid>
            </Grid>

            {/* Global template toggle */}
            <Box 
              onClick={() => setTemplateFormData(prev => ({ ...prev, is_global: !prev.is_global }))}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                p: 2,
                borderRadius: 2,
                bgcolor: templateFormData.is_global ? 'rgba(33,150,243,0.1)' : 'rgba(255,255,255,0.03)',
                border: templateFormData.is_global 
                  ? '1px solid rgba(33,150,243,0.4)' 
                  : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { 
                  borderColor: templateFormData.is_global 
                    ? 'rgba(33,150,243,0.6)' 
                    : 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: templateFormData.is_global ? 'rgba(33,150,243,0.2)' : 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {templateFormData.is_global ? (
                    <PublicIcon sx={{ color: '#2196f3' }} />
                  ) : (
                    <LockIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                  )}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: templateFormData.is_global ? '#2196f3' : '#fff' }}>
                    {templateFormData.is_global ? 'Global mal' : 'Prosjekt-mal'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {templateFormData.is_global 
                      ? 'Tilgjengelig i alle prosjekter' 
                      : 'Kun tilgjengelig i dette prosjektet'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{
                width: 50,
                height: 26,
                borderRadius: 13,
                bgcolor: templateFormData.is_global ? '#2196f3' : 'rgba(255,255,255,0.2)',
                position: 'relative',
                transition: 'all 0.2s',
              }}>
                <Box sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  position: 'absolute',
                  top: 2,
                  left: templateFormData.is_global ? 26 : 2,
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
              </Box>
            </Box>

            {/* Preview of items */}
            {templateFormData.items.length > 0 && (
              <Box sx={{ 
                bgcolor: 'rgba(0,0,0,0.2)', 
                borderRadius: 2, 
                p: 2,
                maxHeight: 200,
                overflow: 'auto',
              }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>
                  Inkluderte elementer:
                </Typography>
                {templateFormData.items.map((item, idx) => (
                  <Chip
                    key={idx}
                    label={item.name}
                    size="small"
                    sx={{ 
                      m: 0.5, 
                      bgcolor: 'rgba(76,175,80,0.15)', 
                      color: '#4caf50',
                      borderRadius: 1,
                    }}
                  />
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5,
          gap: 1,
        }}>
          <Button
            onClick={() => setTemplateFormOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              borderRadius: 2,
              px: 3,
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveTemplate}
            disabled={!templateFormData.name.trim()}
            sx={{ 
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              borderRadius: 2,
              px: 3,
              fontWeight: 600,
            }}
          >
            {editingTemplate ? 'Oppdater mal' : 'Opprett mal'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={shopDialogOpen}
        onClose={() => setShopDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(30,136,229,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(33,150,243,0.3)',
            }}>
              <ShoppingCartIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Kjøp utstyr via foto.no</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Norges ledende utstyrsleverandør
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setShopDialogOpen(false)} 
            sx={{ 
              ...focusVisibleStyles,
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Box sx={{ 
            textAlign: 'center', 
            py: 5,
            background: 'linear-gradient(135deg, rgba(33,150,243,0.08) 0%, rgba(33,150,243,0.03) 100%)',
            borderRadius: 2,
            border: '1px solid rgba(33,150,243,0.15)',
          }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(33,150,243,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}>
              <ShoppingCartIcon sx={{ fontSize: 40, color: '#2196f3' }} />
            </Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
              Bygg nytt lager via foto.no
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 4, maxWidth: 500, mx: 'auto' }}>
              Norges ledende leverandør av foto- og videoutstyr. 
              Finn alt du trenger for profesjonell produksjon.
            </Typography>
            <Stack spacing={1.5} sx={{ maxWidth: 320, mx: 'auto' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/foto/kamera', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Kameraer
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/foto/foto-tilbehor/belysning', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Lys og belysning
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/video', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Videoutstyr
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no/lyd', '_blank')}
                sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
                  color: '#fff', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #42a5f5 0%, #2196f3 100%)' } 
                }}
              >
                Lydopptak
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={() => window.open('https://www.foto.no', '_blank')}
                sx={{ 
                  borderColor: 'rgba(33,150,243,0.5)', 
                  color: '#2196f3', 
                  py: 1.5,
                  borderRadius: 2,
                  fontWeight: 600,
                  '&:hover': { borderColor: '#2196f3', bgcolor: 'rgba(33,150,243,0.1)' } 
                }}
              >
                Alle kategorier
              </Button>
            </Stack>
          </Box>
          
          {vendorLinks.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
                Anbefalte produkter
              </Typography>
              <Grid container spacing={2}>
                {vendorLinks.filter(l => l.is_recommended).map(link => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={link.id}>
                    <Card 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
                      }}
                      onClick={() => window.open(link.affiliate_url || link.product_url, '_blank')}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 600 }}>
                          {link.product_name}
                        </Typography>
                        {link.description && (
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
                            {link.description}
                          </Typography>
                        )}
                        {link.price && (
                          <Typography variant="h6" sx={{ color: '#4caf50', mt: 1, fontWeight: 700 }}>
                            kr {link.price.toLocaleString('nb-NO')},-
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <Chip label={link.category} size="small" sx={{ bgcolor: 'rgba(33,150,243,0.2)', color: '#2196f3' }} />
                          <OpenInNewIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => setShopDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog
        open={newCategoryDialogOpen}
        onClose={() => {
          setNewCategoryDialogOpen(false);
          setNewCategoryName('');
        }}
        maxWidth="xs"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(67,160,71,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
            }}>
              <AddIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Ny kategori
            </Typography>
          </Box>
          <IconButton 
            onClick={() => setNewCategoryDialogOpen(false)}
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
            Egendefinerte kategorier lagres lokalt og er tilgjengelige for dette prosjektet.
          </Typography>
          <TextField
            fullWidth
            label="Kategorinavn"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategoryName.trim()) {
                handleAddCustomCategory();
              }
            }}
            autoFocus
            placeholder="F.eks. Drone, Greenscreen..."
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                bgcolor: 'rgba(0,0,0,0.2)', 
                color: '#fff',
                borderRadius: 2,
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(76,175,80,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#4caf50' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
          />
          {customCategories.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>
                Dine egendefinerte kategorier:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {customCategories.map(cat => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    onDelete={() => handleRemoveCustomCategory(cat)}
                    sx={{ 
                      bgcolor: 'rgba(76,175,80,0.15)', 
                      color: '#4caf50',
                      '& .MuiChip-deleteIcon': { color: 'rgba(76,175,80,0.5)', '&:hover': { color: '#f44336' } },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5, 
          px: 3,
          gap: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.2) 0%, transparent 100%)',
        }}>
          <Button
            onClick={() => {
              setNewCategoryDialogOpen(false);
              setNewCategoryName('');
            }}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleAddCustomCategory}
            variant="contained"
            disabled={!newCategoryName.trim() || allCategories.includes(newCategoryName.trim())}
            sx={{
              background: 'linear-gradient(135deg, #4caf50 0%, #43a047 100%)',
              color: '#fff',
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              boxShadow: '0 4px 14px rgba(76,175,80,0.3)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.87)',
              },
            }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Picker Dialog */}
      <Dialog
        open={imagePickerOpen}
        onClose={() => {
          setImagePickerOpen(false);
          setImageSearchResults([]);
          setImageSearchQuery('');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3, 
            minHeight: 500,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(156,39,176,0.15) 0%, rgba(142,36,170,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #9c27b0 0%, #8e24aa 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(156,39,176,0.3)',
            }}>
              <PhotoLibraryIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Velg bilde for utstyr
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Søk i flere kilder eller last opp
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={() => setImagePickerOpen(false)}
            sx={{ 
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Tabs
            value={imagePickerTab}
            onChange={(_, v) => setImagePickerTab(v)}
            sx={{
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              px: 2,
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.87)' },
              '& .Mui-selected': { color: '#9333ea' },
              '& .MuiTabs-indicator': { bgcolor: '#9333ea' },
            }}
          >
            <Tab icon={<SearchIcon />} label="Søk bilder" iconPosition="start" />
            <Tab icon={<MovieIcon />} label="Filmreferanser" iconPosition="start" />
          </Tabs>
          
          <Box sx={{ p: 2 }}>
            {/* Search Input */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                placeholder={imagePickerTab === 0 ? "Søk etter utstyr, props, rekvisitter..." : "Søk film for referansebilder..."}
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchImages(imageSearchQuery)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': { 
                    bgcolor: 'rgba(255,255,255,0.05)', 
                    color: '#fff',
                  } 
                }}
              />
              <Button
                variant="contained"
                onClick={() => searchImages(imageSearchQuery)}
                disabled={imageSearchLoading || !imageSearchQuery.trim()}
                sx={{ 
                  bgcolor: '#9333ea', 
                  color: '#000',
                  minWidth: 100,
                  '&:hover': { bgcolor: '#6d28d9' },
                }}
              >
                {imageSearchLoading ? <CircularProgress size={20} /> : 'Søk'}
              </Button>
            </Box>
            
            {/* Quick Search Suggestions */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {['Kamera', 'Lys', 'Stativ', 'Mikrofon', 'Drone', 'Generator', 'Film props', 'Studio equipment'].map((term) => (
                <Chip
                  key={term}
                  label={term}
                  size="small"
                  onClick={() => {
                    setImageSearchQuery(term);
                    searchImages(term);
                  }}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.1)', 
                    color: '#fff',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(147,51,234,0.2)' },
                  }}
                />
              ))}
            </Box>
            
            {/* Search Results */}
            {imageSearchLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress sx={{ color: '#9333ea' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  Søker i Pexels, Pixabay, Unsplash, Openverse, Wikimedia...
                </Typography>
              </Box>
            ) : imageSearchResults.length > 0 ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {imageSearchResults.length} bilder funnet • Klikk for å velge
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {[
                      { name: 'pexels', color: '#05bc9e', label: 'Pexels' },
                      { name: 'pixabay', color: '#27a955', label: 'Pixabay' },
                      { name: 'unsplash', color: '#2196f3', label: 'Unsplash' },
                      { name: 'openverse', color: '#9c27b0', label: 'Openverse' },
                      { name: 'wikimedia', color: '#3e85ba', label: 'Wikimedia' },
                      { name: 'shotcafe', color: '#9333ea', label: 'shot.cafe' },
                    ].filter(s => imageSearchResults.some(r => r.source === s.name))
                    .map(s => (
                      <Box
                        key={s.name}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.5,
                          py: 0.25,
                          borderRadius: 0.5,
                          bgcolor: `${s.color}22`,
                        }}
                      >
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.color }} />
                        <Typography variant="caption" sx={{ color: s.color, fontSize: '9px', fontWeight: 600 }}>
                          {s.label} ({imageSearchResults.filter(r => r.source === s.name).length})
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <ImageList cols={isMobile ? 2 : isTablet ? 3 : 4} gap={8} sx={{ maxHeight: 350 }}>
                  {imageSearchResults.map((img) => (
                    <ImageListItem 
                      key={img.id}
                      sx={{ 
                        cursor: 'pointer',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '2px solid transparent',
                        transition: 'all 0.2s',
                        '&:hover': { 
                          border: '2px solid #9333ea',
                          transform: 'scale(1.02)',
                        },
                      }}
                      onClick={() => handleSelectSearchImage(img.url)}
                    >
                      <img
                        src={img.thumbnailUrl}
                        alt={img.description || 'Search result'}
                        loading="lazy"
                        style={{ height: 120, objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.png'; }}
                      />
                      <ImageListItemBar
                        subtitle={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ 
                              textTransform: 'capitalize',
                              bgcolor: 
                                img.source === 'unsplash' ? 'rgba(33,150,243,0.4)' : 
                                img.source === 'pexels' ? 'rgba(5,188,158,0.4)' :
                                img.source === 'pixabay' ? 'rgba(39,169,85,0.4)' :
                                img.source === 'openverse' ? 'rgba(156,39,176,0.4)' :
                                img.source === 'wikimedia' ? 'rgba(62,133,186,0.4)' :
                                img.source === 'shotcafe' ? 'rgba(147,51,234,0.4)' :
                                'rgba(100,100,100,0.4)',
                              px: 0.5,
                              borderRadius: 0.5,
                              fontSize: '9px',
                              fontWeight: 600,
                            }}>
                              {img.source === 'shotcafe' ? 'shot.cafe' : img.source}
                            </Typography>
                            {img.photographer && (
                              <Typography variant="caption" sx={{ opacity: 0.7, ml: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '9px' }}>
                                {img.photographer}
                              </Typography>
                            )}
                          </Box>
                        }
                        sx={{
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          '& .MuiImageListItemBar-title': { fontSize: 12 },
                        }}
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1, display: 'block', textAlign: 'center' }}>
                  Bilder fra Unsplash & shot.cafe • Kun for intern referanse
                </Typography>
              </Box>
            ) : (
              <Box sx={{ 
                textAlign: 'center', 
                py: 6, 
                color: 'rgba(255,255,255,0.87)',
              }}>
                <PhotoLibraryIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
                <Typography variant="body1">
                  Søk etter bilder av utstyr og rekvisitter
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Resultater fra Unsplash og shot.cafe
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button
            onClick={() => {
              setImagePickerOpen(false);
              setImageSearchResults([]);
            }}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,77,77,0.3)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxWidth: 400,
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(244,67,54,0.15) 0%, rgba(211,47,47,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(244,67,54,0.3)',
          }}>
            <DeleteIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Bekreft sletting</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography>
            Er du sikker på at du vil slette <strong>"{equipmentToDelete?.name}"</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
            Denne handlingen kan ikke angres.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          p: 2.5,
          gap: 1,
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
            }}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            sx={{ 
              bgcolor: '#f44336',
              minHeight: TOUCH_TARGET_SIZE,
              borderRadius: 2,
              px: 3,
              '&:hover': { bgcolor: '#d32f2f' },
            }}
          >
            Slett
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog
        open={bulkActionDialogOpen}
        onClose={() => setBulkActionDialogOpen(false)}
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            maxWidth: 450,
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: bulkActionType === 'delete' 
            ? 'linear-gradient(135deg, rgba(244,67,54,0.15) 0%, rgba(211,47,47,0.1) 100%)'
            : 'linear-gradient(135deg, rgba(147,51,234,0.15) 0%, rgba(245,124,0,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: bulkActionType === 'delete'
              ? 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)'
              : 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {bulkActionType === 'delete' ? <DeleteIcon /> : <EditIcon />}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {bulkActionType === 'delete' ? 'Slett valgt utstyr' : 
             bulkActionType === 'status' ? 'Endre status' : 'Tilordne utstyr'}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography sx={{ mb: 2 }}>
            {selectedEquipmentIds.size} utstyr valgt
          </Typography>
          {bulkActionType === 'status' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Ny status</InputLabel>
              <Select
                value={bulkNewStatus}
                onChange={(e) => setBulkNewStatus(e.target.value)}
                label="Ny status"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {bulkActionType === 'assign' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Tilordne til</InputLabel>
              <Select
                value={bulkAssignCrewId}
                onChange={(e) => setBulkAssignCrewId(e.target.value)}
                label="Tilordne til"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {crewMembers.map((crew) => (
                  <MenuItem key={crew.id} value={crew.id}>{crew.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {bulkActionType === 'delete' && (
            <Typography variant="body2" sx={{ color: 'rgba(255,77,77,0.8)' }}>
              Denne handlingen kan ikke angres!
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setBulkActionDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            onClick={handleConfirmBulkAction}
            variant="contained"
            sx={{ 
              bgcolor: bulkActionType === 'delete' ? '#f44336' : '#9333ea',
              '&:hover': { bgcolor: bulkActionType === 'delete' ? '#d32f2f' : '#6d28d9' },
            }}
          >
            Bekreft
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(156,39,176,0.15) 0%, rgba(142,36,170,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #9c27b0 0%, #8e24aa 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <HistoryIcon sx={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Historikk</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {selectedEquipmentHistory?.name}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setHistoryDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {equipmentHistory.map((entry) => (
              <Box key={entry.id} sx={{ 
                p: 2, 
                bgcolor: 'rgba(255,255,255,0.03)', 
                borderRadius: 2,
                borderLeft: '3px solid #9c27b0',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{entry.action}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                    {new Date(entry.timestamp).toLocaleString('nb-NO')}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>{entry.details}</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>av {entry.user}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button onClick={() => setHistoryDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Maintenance Dialog */}
      <Dialog
        open={maintenanceDialogOpen}
        onClose={() => setMaintenanceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(0,150,136,0.15) 0%, rgba(0,137,123,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #009688 0%, #00897b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <BuildIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Planlegg vedlikehold</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {selectedEquipmentMaintenance?.name}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            <TextField
              label="Dato"
              type="date"
              value={maintenanceForm.scheduledDate}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Type vedlikehold</InputLabel>
              <Select
                value={maintenanceForm.type}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })}
                label="Type vedlikehold"
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <MenuItem value="routine">Rutinemessig vedlikehold</MenuItem>
                <MenuItem value="repair">Reparasjon</MenuItem>
                <MenuItem value="inspection">Inspeksjon</MenuItem>
                <MenuItem value="calibration">Kalibrering</MenuItem>
                <MenuItem value="cleaning">Rengjøring</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notater"
              value={maintenanceForm.notes}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setMaintenanceDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            onClick={handleScheduleMaintenance}
            variant="contained"
            sx={{ bgcolor: '#009688', '&:hover': { bgcolor: '#00897b' } }}
          >
            Planlegg
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Booking Dialog */}
      <Dialog
        open={createBookingDialogOpen}
        onClose={() => setCreateBookingDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Grow}
        PaperProps={{ 
          sx: { 
            bgcolor: '#1c2128', 
            color: '#fff', 
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, rgba(33,150,243,0.15) 0%, rgba(30,136,229,0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          py: 2,
        }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #2196f3 0%, #1e88e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CalendarTodayIcon sx={{ color: '#fff' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Ny booking</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Startdato"
                type="date"
                value={bookingForm.startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setBookingForm(f => ({ ...f, startDate: v }));
                  checkBookingConflicts(v, bookingForm.endDate);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
              <TextField
                label="Sluttdato"
                type="date"
                value={bookingForm.endDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setBookingForm(f => ({ ...f, endDate: v }));
                  checkBookingConflicts(bookingForm.startDate, v);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              />
            </Box>
            {conflictChecking && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.6)' }}>
                <CircularProgress size={14} sx={{ color: 'inherit' }} />
                <Typography variant="caption">Sjekker konflikter…</Typography>
              </Box>
            )}
            {!conflictChecking && bookingConflicts.length > 0 && (
              <Box sx={{
                p: 2, borderRadius: 2,
                bgcolor: 'rgba(147,51,234,0.12)',
                border: '1px solid rgba(147,51,234,0.4)',
                display: 'flex', alignItems: 'flex-start', gap: 1.5,
              }}>
                <WarningIcon sx={{ color: '#9333ea', mt: 0.25, flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" sx={{ color: '#c084fc', fontWeight: 600 }}>
                    {bookingConflicts.length} konflikt{bookingConflicts.length > 1 ? 'er' : ''} funnet
                  </Typography>
                  {bookingConflicts.map(c => (
                    <Typography key={c.id} variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                      {c.type === 'booking' ? `Booking: ${c.purpose ?? ''}` : c.reason ?? c.type} ({c.start_date} – {c.end_date})
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
            <TextField
              label="Formål"
              value={bookingForm.purpose}
              onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <TextField
              label="Notater"
              value={bookingForm.notes}
              onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateBookingDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            onClick={handleCreateBooking}
            variant="contained"
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}
          >
            Opprett booking
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Check-out Dialog ─────────────────────────── */}
      <Dialog open={checkoutDialogOpen} onClose={() => setCheckoutDialogOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #2196f3, #1565c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckOutIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Sjekk ut utstyr</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{checkoutEquipment?.name}</Typography>
          </Box>
          <IconButton onClick={() => setCheckoutDialogOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Sjekkes ut til *</InputLabel>
              <Select value={checkoutForm.crewId} onChange={(e) => setCheckoutForm(f => ({ ...f, crewId: e.target.value }))} label="Sjekkes ut til *"
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                {crewMembers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Antall" type="number" inputProps={{ min: 1, max: checkoutEquipment?.quantity ?? 99 }}
              value={checkoutForm.quantity}
              onChange={(e) => setCheckoutForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }}
            />
            <TextField label="Formål" value={checkoutForm.purpose} onChange={(e) => setCheckoutForm(f => ({ ...f, purpose: e.target.value }))} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }} />
            {!isOnline && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(147,51,234,0.1)', border: '1px solid rgba(147,51,234,0.3)', display: 'flex', gap: 1, alignItems: 'center' }}>
                <OfflineIcon sx={{ color: '#9333ea', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: '#c084fc' }}>Du er offline — operasjonen lagres i kø og synkroniseres automatisk</Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setCheckoutDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Avbryt</Button>
          <Button onClick={handleConfirmCheckout} variant="contained" disabled={!checkoutForm.crewId}
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}>
            {isOnline ? 'Sjekk ut' : 'Legg i kø'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Check-in Dialog ──────────────────────────── */}
      <Dialog open={checkinDialogOpen} onClose={() => setCheckinDialogOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #4caf50, #2e7d32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckInIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Lever inn utstyr</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{checkinEquipment?.name}</Typography>
          </Box>
          <IconButton onClick={() => setCheckinDialogOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Tilstand ved retur</InputLabel>
              <Select value={checkinForm.condition} onChange={(e) => setCheckinForm(f => ({ ...f, condition: e.target.value as Equipment['condition'] }))} label="Tilstand ved retur"
                sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}>
                {Object.entries(CONDITION_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Merknader" multiline rows={2} value={checkinForm.notes} onChange={(e) => setCheckinForm(f => ({ ...f, notes: e.target.value }))} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }, '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setCheckinDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Avbryt</Button>
          <Button onClick={handleConfirmCheckin} variant="contained" sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#43a047' } }}>Lever inn</Button>
        </DialogActions>
      </Dialog>

      {/* ── Reports Dialog ───────────────────────────── */}
      <Dialog open={reportsDialogOpen} onClose={() => setReportsDialogOpen(false)} maxWidth="md" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 0 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #9c27b0, #6a1b9a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReportIcon sx={{ color: '#fff' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Rapporter</Typography>
          <IconButton onClick={() => setReportsDialogOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <Tabs value={reportsTab} onChange={(_, v) => setReportsTab(v)} sx={{ px: 3, '& .MuiTabs-indicator': { bgcolor: '#9c27b0' }, '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)', '&.Mui-selected': { color: '#ce93d8' } } }}>
          <Tab label="Utstyrsliste" />
          <Tab label={`Manglende (${missingItems.length})`} />
          <Tab label={`Vedlikehold / Rep. (${maintenanceItems.length})`} />
        </Tabs>
        <DialogContent sx={{ pt: 2 }}>
          {reportsTab === 0 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                Fullstendig utstyrsliste for prosjektet — {equipment.length} elementer
              </Typography>
              <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                {equipment.map(eq => (
                  <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Chip label={STATUS_LABELS[eq.status]} size="small" sx={{ bgcolor: `${STATUS_COLORS[eq.status]}20`, color: STATUS_COLORS[eq.status], fontSize: '0.65rem', minWidth: 80 }} />
                    <Typography variant="body2" sx={{ color: '#fff', flex: 1, fontWeight: 600 }}>{eq.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{eq.brand} {eq.model}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 50 }}>×{eq.quantity}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 80 }}>{getCrewName(eq.assignees?.[0]?.crew_id ?? '')}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          {reportsTab === 1 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                Tilgjengelig utstyr uten tildelt ansvarlig — {missingItems.length} elementer
              </Typography>
              {missingItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
                  <Typography sx={{ color: '#4caf50' }}>Alt utstyr er tilordnet</Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {missingItems.map(eq => (
                    <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <MissingItemIcon sx={{ color: '#9333ea', fontSize: 18, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: '#fff', flex: 1, fontWeight: 600 }}>{eq.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{eq.category}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>×{eq.quantity}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {reportsTab === 2 && (
            <Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
                Utstyr som trenger vedlikehold eller reparasjon — {maintenanceItems.length} elementer
              </Typography>
              {maintenanceItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
                  <Typography sx={{ color: '#4caf50' }}>Ingen vedlikeholdsoppgaver</Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
                  {maintenanceItems.map(eq => (
                    <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <WarningIcon sx={{ color: '#f44336', fontSize: 18, flexShrink: 0 }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{eq.name}</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>{eq.notes ?? 'Ingen merknader'}</Typography>
                      </Box>
                      <Chip label={CONDITION_LABELS[eq.condition]} size="small" sx={{ bgcolor: `${CONDITION_COLORS[eq.condition]}20`, color: CONDITION_COLORS[eq.condition], fontSize: '0.65rem' }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => setReportsDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Lukk</Button>
          <Button onClick={handleDownloadGearList} variant="contained" startIcon={<DownloadIcon />}
            sx={{ bgcolor: '#9c27b0', '&:hover': { bgcolor: '#8e24aa' } }}>
            Last ned CSV
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Offline outbox viewer ────────────────────── */}
      <Dialog open={offlineOutboxOpen} onClose={() => setOfflineOutboxOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Grow}
        PaperProps={{ sx: { bgcolor: 'rgba(28,33,40,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 1 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'linear-gradient(135deg, #f44336, #b71c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <OfflineIcon sx={{ color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>Offline-kø</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>{offlineQueueCount} operasjon(er) venter</Typography>
          </Box>
          <IconButton onClick={() => setOfflineOutboxOpen(false)} sx={{ ml: 'auto', color: 'rgba(255,255,255,0.6)' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {offlineQueue.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
              <Typography sx={{ color: '#4caf50' }}>Ingen ventende operasjoner</Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {offlineQueue.map(e => (
                <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {e.type === 'checkout' ? <CheckOutIcon sx={{ color: '#2196f3', fontSize: 20 }} /> : <CheckInIcon sx={{ color: '#4caf50', fontSize: 20 }} />}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                      {e.type === 'checkout' ? 'Sjekk ut' : 'Lever inn'} — {e.payload.equipmentId.slice(0, 8)}…
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(e.ts).toLocaleString('nb-NO')}
                    </Typography>
                  </Box>
                  <Chip label="Venter" size="small" sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#c084fc' }} />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2.5, gap: 1 }}>
          <Button onClick={() => { persistOfflineQueue([]); setOfflineOutboxOpen(false); }} sx={{ color: '#f44336' }}>Slett kø</Button>
          <Button onClick={() => setOfflineOutboxOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>Lukk</Button>
          <Button onClick={handleSyncOfflineQueue} variant="contained" startIcon={<SyncIcon />} disabled={!isOnline}
            sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1e88e5' } }}>
            Synkroniser nå
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default EquipmentManagementPanel;
