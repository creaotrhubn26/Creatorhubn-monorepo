import React, { useState, useMemo, useEffect, useId, useCallback } from 'react';
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
  Chip,
  Stack,
  Tooltip,
  Collapse,
  Checkbox,
  FormControl,
  InputLabel,
  InputAdornment,
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
  Alert,
  Snackbar,
  useTheme,
  useMediaQuery,
  Grow,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Build as BuildIcon,
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
  Cancel as CancelIcon,
  Save as SaveIcon,
  Image as ImageIcon,
  Photo as PhotoIcon,
  CloudUpload as CloudUploadIcon,
  Inventory as InventoryIcon,
  Inventory2 as Inventory2Icon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { 
  LocationsIcon as LocationIcon, 
  StatsIcon, 
  PropsIcon,
  PersonNameIcon,
  NotesIcon,
  QuantityIcon,
  StorageIcon,
} from './icons/CastingIcons';
import type { Prop } from '../models/casting';
import { castingService } from '../services/castingService';
import globalTagService from '../services/globalTagService';
import { useToast } from './ToastStack';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import equipPng from './icons/Keep/roleroom_equip.png';
import WarehouseInventoryDialog, { type WarehouseDialogItem } from './shared/WarehouseInventoryDialog';
import warehouseInventoryService from '../services/warehouseInventoryService';
import GlobalMentionHelper from './shared/GlobalMentionHelper';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';
// GLB3DPreview stub — renders inline 3D preview placeholder
const GLB3DPreview = ({ _src, width, height }: { _src?: string; width?: number; height?: number }) => (
  <Box sx={{ width: width || 200, height: height || 200, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1 }}>
    <Typography variant="caption" color="text.secondary">3D Preview</Typography>
  </Box>
);

import { TOUCH_TARGET_SIZE } from '../constants/accessibility';

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #9333ea',
    outlineOffset: 2,
  },
};

const formatPropNoteTimestamp = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const OPEN_PROP_CREATE_MODAL_EVENT = 'role-room:open-prop-create-modal';

const blurFocusedElement = () => {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
};

type SortField = 'name' | 'category' | 'quantity' | 'scenes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type PanelMode = 'standard' | 'pro';
type PropItemType = 'equipment' | 'prop';
type PropItemTypeFilter = 'all' | PropItemType;

interface CategoryDefinition {
  key: string;
  color: string;
  itemType: PropItemType;
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  { key: 'equipment', color: '#2196f3', itemType: 'equipment' },
  { key: 'vehicle', color: '#607d8b', itemType: 'equipment' },
  { key: 'sanitation', color: '#26c6da', itemType: 'equipment' },
  { key: 'power', color: '#ffb300', itemType: 'equipment' },
  { key: 'safety', color: '#ef5350', itemType: 'equipment' },
  { key: 'admin', color: '#7e57c2', itemType: 'equipment' },
  { key: 'weather', color: '#4fc3f7', itemType: 'equipment' },
  { key: 'logistics', color: '#66bb6a', itemType: 'equipment' },
  { key: 'furniture', color: '#8b4513', itemType: 'prop' },
  { key: 'decoration', color: '#9c27b0', itemType: 'prop' },
  { key: 'costume', color: '#e91e63', itemType: 'prop' },
  { key: 'prop', color: '#ab47bc', itemType: 'prop' },
  { key: 'food', color: '#4caf50', itemType: 'prop' },
  { key: 'other', color: '#9333ea', itemType: 'prop' },
];

const CATEGORY_BY_KEY = new Map(CATEGORY_DEFINITIONS.map((category) => [category.key, category]));

const normalizeCategoryKey = (category?: string): string => (category || '').trim().toLowerCase();
const normalizeItemText = (value?: string): string => (value || '').trim().toLowerCase();
const includesAnyKeyword = (value: string, keywords: string[]): boolean =>
  keywords.some((keyword) => value.includes(keyword));

const PROP_NAME_HINTS = [
  'kirkeklokk',
  'lydeffekt',
  'militærutstyr',
  'våpen',
  'stunt-bil',
  'stunt bil',
  'tunnelboremaskin',
  'uv-lys',
  'kunstig sollys',
];

const EQUIPMENT_NAME_HINTS = [
  'aggregat',
  'kabeltrommel',
  'strømfordelingsskap',
  'kabelbro',
  'ups',
  'jording',
  'brannslukker',
  'førstehjelp',
  'refleksvest',
  'sperrebånd',
  'vaktutstyr',
  'quiet on set',
  'crew only',
  'håndvaskstasjon',
  'whiteboard',
  'call sheet',
  'laminerte dagsplaner',
  'walkie',
  'headset',
  'navneskilt',
  'presenning',
  'regnponcho',
  'parasoll',
  'varmelampe',
  'snøskuffe',
  'isfjerner',
  'hånddesinfeksjon',
  'tralle',
  'dolly cart',
  'lagerboks',
  'flight case',
  'låsbare skap',
  'kabelkasse',
  'regntelt',
  'sminke- og kostymetelt',
  'catering-telt',
  'skyggetelt',
  'vindbeskyttelse',
  'sandsekker',
  'portable toaletter',
  'toalettvogn',
  'søppelhåndtering',
  'sammenleggbare bord',
  'sammenleggbare stoler',
  'varmeovner',
  'vifter',
  'tepper',
];

const EQUIPMENT_CATEGORY_HINTS: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'sanitation',
    keywords: ['toalett', 'toalettvogn', 'håndvask', 'desinfeksjon', 'søppel', 'søppelhåndtering'],
  },
  {
    category: 'power',
    keywords: ['aggregat', 'kabeltrommel', 'strømfordelingsskap', 'kabelbro', 'ups', 'jording', 'jordingsutstyr'],
  },
  {
    category: 'safety',
    keywords: ['brannslukker', 'førstehjelp', 'refleksvest', 'sperrebånd', 'vaktutstyr', 'quiet on set', 'crew only'],
  },
  {
    category: 'admin',
    keywords: ['whiteboard', 'call sheet', 'dagsplan', 'walkie', 'headset', 'synkronisert', 'navneskilt'],
  },
  {
    category: 'weather',
    keywords: [
      'regntelt',
      'værbeskyttelse',
      'sminke- og kostymetelt',
      'catering-telt',
      'skyggetelt',
      'vindbeskyttelse',
      'sandsekker',
      'presenning',
      'regnponcho',
      'parasoll',
      'varmelampe',
      'snøskuffe',
      'isfjerner',
      'varmeovner',
      'vifter',
      'tepper',
    ],
  },
  {
    category: 'logistics',
    keywords: ['tralle', 'dolly cart', 'lagerboks', 'flight case', 'låsbare skap', 'kabelkasse', 'sammenleggbare bord', 'sammenleggbare stoler'],
  },
];

const inferItemTypeFromName = (name?: string): PropItemType | null => {
  const normalized = normalizeItemText(name);
  if (!normalized) return null;
  if (includesAnyKeyword(normalized, PROP_NAME_HINTS)) return 'prop';
  if (includesAnyKeyword(normalized, EQUIPMENT_NAME_HINTS)) return 'equipment';
  return null;
};

const inferEquipmentCategoryFromName = (name?: string): string | null => {
  const normalized = normalizeItemText(name);
  if (!normalized) return null;
  const match = EQUIPMENT_CATEGORY_HINTS.find((entry) => includesAnyKeyword(normalized, entry.keywords));
  return match?.category || null;
};

const resolveItemTypeFromCategory = (category?: string): PropItemType => {
  const normalized = normalizeCategoryKey(category);
  if (normalized && CATEGORY_BY_KEY.has(normalized)) {
    return CATEGORY_BY_KEY.get(normalized)!.itemType;
  }
  if (
    normalized.includes('equip') ||
    normalized.includes('kamera') ||
    normalized.includes('lyd') ||
    normalized.includes('light') ||
    normalized.includes('vehicle') ||
    normalized.includes('power') ||
    normalized.includes('safety') ||
    normalized.includes('weather') ||
    normalized.includes('sanitation') ||
    normalized.includes('admin') ||
    normalized.includes('logistics')
  ) {
    return 'equipment';
  }
  return 'prop';
};

interface PropManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
}

export function PropManagementPanel({ projectId, onUpdate }: PropManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();
  const { user } = useAuth();
  const { t } = useT();
  const noteActorLabel = useMemo(() => {
    const raw = user?.displayName ?? user?.name ?? user?.email;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : t('prop.unknownUser');
  }, [user, t]);
  const noteActorId = user?.id !== undefined && user?.id !== null ? String(user.id) : undefined;

  // Unique IDs for WCAG
  const baseId = useId();
  const dialogTitleId = `${baseId}-dialog-title`;
  const dialogDescId = `${baseId}-dialog-desc`;

  // Core state
  const [props, setProps] = useState<Prop[]>([]);
  
  // Load props when projectId changes
  useEffect(() => {
    const loadProps = async () => {
      if (projectId) {
        try {
          const loadedProps = await castingService.getProps(projectId);
          setProps(Array.isArray(loadedProps) ? loadedProps : []);
        } catch (error) {
          console.error('Error loading props:', error);
          setProps([]);
        }
      }
    };
    loadProps();
  }, [projectId]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<Prop | null>(null);
  const [formData, setFormData] = useState<Partial<Prop>>({
    name: '',
    itemType: 'prop',
    category: 'prop',
    description: '',
    images: [],
    availability: {},
    assignedScenes: [],
    quantity: 1,
    location: '',
    notes: '',
  });
  const mentionCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...props.map((item) => item.name),
            formData.name,
            formData.location,
          ]
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length >= 2),
        ),
      ),
    [formData.location, formData.name, props],
  );
  const applyMentionSuggestion = useCallback((sourceText: string | undefined, name: string): string => {
    const current = typeof sourceText === 'string' ? sourceText : '';
    if (!current.trim()) return name;
    const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
    return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
  }, []);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState<PropItemTypeFilter>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [panelMode, setPanelMode] = useState<PanelMode>('standard');
  const [showStats, setShowStats] = useState(false);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [warehouseIssueCount, setWarehouseIssueCount] = useState(0);
  const [warehouseStockByItem, setWarehouseStockByItem] = useState<
    Record<string, { quantity: number; reserved: number; available: number }>
  >({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Favorites with database sync
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Load favorites from database
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'prop');
        if (dbFavorites.length > 0) {
          setFavorites(new Set(dbFavorites));
          return;
        }
      } catch (error) {
        console.warn('Database unavailable, using localStorage:', error);
      }
      const saved = localStorage.getItem(`prop-favorites-${projectId}`);
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    };
    loadFavorites();
  }, [projectId]);
  
  // Save favorites to database
  useEffect(() => {
    const saveFavorites = async () => {
      localStorage.setItem(`prop-favorites-${projectId}`, JSON.stringify([...favorites]));
      try {
        const { favoritesApi } = await import('../services/castingApiService');
        await favoritesApi.set(projectId, 'prop', [...favorites]);
      } catch (error) {
        console.warn('Database save failed:', error);
      }
    };
    if (favorites.size > 0 || localStorage.getItem(`prop-favorites-${projectId}`)) {
      saveFavorites();
    }
  }, [favorites, projectId]);

  // Undo delete state
  const [deletedProp, setDeletedProp] = useState<Prop | null>(null);
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // MenuProps for Select components to ensure proper rendering within Dialog
  const selectMenuProps = {
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
            bgcolor: 'rgba(147, 51, 234, 0.15)',
          },
          '&.Mui-selected': {
            bgcolor: 'rgba(147, 51, 234, 0.25)',
            '&:hover': {
              bgcolor: 'rgba(147, 51, 234, 0.35)',
            },
          },
        },
      },
    },
  };

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();

    CATEGORY_DEFINITIONS.forEach((category) => {
      if (itemTypeFilter === 'all' || category.itemType === itemTypeFilter) {
        categories.add(category.key);
      }
    });

    props.forEach((prop) => {
      const effectiveType = getItemType(prop);
      const effectiveCategory = getItemCategory(prop, effectiveType);
      if (!effectiveCategory) return;
      if (itemTypeFilter === 'all' || effectiveType === itemTypeFilter) {
        categories.add(effectiveCategory);
      }
    });

    return Array.from(categories);
  }, [itemTypeFilter, props]);

  const formItemType: PropItemType = formData.itemType === 'equipment' ? 'equipment' : 'prop';

  const formCategoryOptions = useMemo(
    () => CATEGORY_DEFINITIONS.filter((category) => category.itemType === formItemType).map((category) => category.key),
    [formItemType]
  );

  const warehouseDialogItems = useMemo<WarehouseDialogItem[]>(
    () =>
      props.map((prop) => {
        const itemType = getItemType(prop);
        return {
          id: prop.id,
          itemType,
          name: prop.name,
          quantity: Number(prop.quantity || 0),
          locationLabel: prop.location?.trim() || undefined,
          category: getItemCategory(prop, itemType),
        };
      }),
    [props]
  );

  const warehouseLocationSeeds = useMemo(() => {
    const seen = new Set<string>();
    const seeds: Array<{ id: string; name: string }> = [];

    props.forEach((prop) => {
      const label = prop.location?.trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'location';
      seeds.push({
        id: `prop-location-${slug}`,
        name: label,
      });
    });

    return seeds;
  }, [props]);

  const warehouseTotals = useMemo(() => {
    return Object.values(warehouseStockByItem).reduce(
      (acc, current) => ({
        quantity: acc.quantity + current.quantity,
        reserved: acc.reserved + current.reserved,
        available: acc.available + current.available,
      }),
      { quantity: 0, reserved: 0, available: 0 }
    );
  }, [warehouseStockByItem]);

  const refreshWarehouseSummary = useCallback(() => {
    if (!projectId || warehouseDialogItems.length === 0) {
      setWarehouseStockByItem({});
      setWarehouseIssueCount(0);
      return;
    }

    warehouseInventoryService.bootstrapProject(projectId, {
      locations: warehouseLocationSeeds,
      items: warehouseDialogItems,
    });

    const nextTotals: Record<string, { quantity: number; reserved: number; available: number }> = {};
    warehouseDialogItems.forEach((item) => {
      nextTotals[item.id] = warehouseInventoryService.getItemTotals(projectId, item.itemType, item.id);
    });
    setWarehouseStockByItem(nextTotals);

    const issues = warehouseInventoryService.listConsistencyIssues(projectId, warehouseDialogItems);
    setWarehouseIssueCount(issues.length);
  }, [projectId, warehouseDialogItems, warehouseLocationSeeds]);

  useEffect(() => {
    refreshWarehouseSummary();
  }, [refreshWarehouseSummary]);

  const categoryLabelByKey = useMemo<Record<string, string>>(
    () => ({
      equipment: t('prop.cat.equipment'),
      vehicle: t('prop.cat.vehicle'),
      sanitation: t('prop.cat.sanitation'),
      power: t('prop.cat.power'),
      safety: t('prop.cat.safety'),
      admin: t('prop.cat.admin'),
      weather: t('prop.cat.weather'),
      logistics: t('prop.cat.logistics'),
      furniture: t('prop.cat.furniture'),
      decoration: t('prop.cat.decoration'),
      costume: t('prop.cat.costume'),
      prop: t('prop.cat.prop'),
      food: t('prop.cat.food'),
      other: t('prop.cat.other'),
    }),
    [t]
  );

  const getCategoryLabel = (category?: string): string => {
    const normalized = normalizeCategoryKey(category);
    if (!normalized) return categoryLabelByKey.other;
    return categoryLabelByKey[normalized] || normalized;
  };

  const getCategoryColor = (category?: string): string => {
    const normalized = normalizeCategoryKey(category);
    if (!normalized) return '#9333ea';
    return CATEGORY_BY_KEY.get(normalized)?.color || '#9333ea';
  };

  function getItemType(prop: Prop): PropItemType {
    const inferredType = inferItemTypeFromName(prop.name);
    if (inferredType) return inferredType;

    const explicitType = typeof prop.itemType === 'string' ? prop.itemType : '';
    if (explicitType === 'equipment') return 'equipment';
    if (explicitType === 'prop') return 'prop';
    return resolveItemTypeFromCategory(prop.category);
  }

  function getItemCategory(prop: Prop, itemTypeOverride?: PropItemType): string {
    const itemType = itemTypeOverride || getItemType(prop);
    const normalizedCategory = normalizeCategoryKey(prop.category);
    const mappedCategory = normalizedCategory ? CATEGORY_BY_KEY.get(normalizedCategory) : undefined;

    if (mappedCategory && mappedCategory.itemType === itemType) {
      return normalizedCategory;
    }

    if (itemType === 'equipment') {
      const inferredEquipmentCategory = inferEquipmentCategoryFromName(prop.name);
      if (inferredEquipmentCategory) return inferredEquipmentCategory;
      if (mappedCategory?.itemType === 'equipment') return normalizedCategory;
      return 'equipment';
    }

    if (mappedCategory?.itemType === 'prop') return normalizedCategory;
    return 'prop';
  }

  const getItemTypeLabel = (itemType: PropItemType): string =>
    itemType === 'equipment' ? categoryLabelByKey.equipment : categoryLabelByKey.prop;

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem(`prop-favorites-${projectId}`, JSON.stringify([...favorites]));
  }, [favorites, projectId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        handleOpenDialog();
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
  }, [dialogOpen]);

  useEffect(() => {
    if (filterCategory === 'all') return;
    if (!availableCategories.includes(filterCategory)) {
      setFilterCategory('all');
    }
  }, [availableCategories, filterCategory]);

  // Filtered and sorted props
  const filteredAndSortedProps = useMemo(() => {
    let result = [...props];

    if (itemTypeFilter !== 'all') {
      result = result.filter((prop) => getItemType(prop) === itemTypeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) => {
          const effectiveCategory = getItemCategory(p);
          return (
            p.name.toLowerCase().includes(query) ||
            effectiveCategory.toLowerCase().includes(query) ||
            getCategoryLabel(effectiveCategory).toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query) ||
            p.location?.toLowerCase().includes(query) ||
            p.notes?.toLowerCase().includes(query)
          );
        }
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter((p) => getItemCategory(p) === filterCategory);
    }

    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 1 : 0;
      const bFav = favorites.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'nb');
          break;
        case 'category':
          comparison = getCategoryLabel(getItemCategory(a)).localeCompare(getCategoryLabel(getItemCategory(b)), 'nb');
          break;
        case 'quantity':
          comparison = (a.quantity || 1) - (b.quantity || 1);
          break;
        case 'scenes':
          comparison = (a.assignedScenes?.length || 0) - (b.assignedScenes?.length || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [props, searchQuery, itemTypeFilter, filterCategory, sortField, sortDirection, favorites, t]);

  // Statistics
  const stats = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    const itemTypeCount: Record<PropItemType, number> = { equipment: 0, prop: 0 };
    let totalQuantity = 0;

    props.forEach((prop) => {
      const itemType = getItemType(prop);
      const categoryKey = getItemCategory(prop, itemType);
      categoryCount[categoryKey] = (categoryCount[categoryKey] || 0) + 1;
      itemTypeCount[itemType] += 1;
      totalQuantity += prop.quantity || 1;
    });

    return {
      total: props.length,
      totalQuantity,
      categoryCount,
      itemTypeCount,
      favorites: favorites.size,
    };
  }, [props, favorites]);

  const proMetrics = useMemo(() => {
    const safeProps = filteredAndSortedProps;
    const readyCount = safeProps.filter((prop) => {
      const hasLocation = Boolean(prop.location?.trim());
      const assignedScenes = Array.isArray(prop.assignedScenes) ? prop.assignedScenes : [];
      return hasLocation && assignedScenes.length > 0 && (prop.quantity || 0) > 0;
    }).length;
    const missingLocationCount = safeProps.filter((prop) => !prop.location?.trim()).length;
    const missingSceneCount = safeProps.filter((prop) => !Array.isArray(prop.assignedScenes) || prop.assignedScenes.length === 0).length;
    const lowStockCount = safeProps.filter((prop) => (prop.quantity || 0) <= 1).length;

    return {
      readyCount,
      missingLocationCount,
      missingSceneCount,
      lowStockCount,
    };
  }, [filteredAndSortedProps]);

  // Handlers
  const openCreateDialogForType = (type: PropItemType) => {
    setEditingProp(null);
    setFormData({
      name: '',
      itemType: type,
      category: type === 'equipment' ? 'equipment' : 'prop',
      description: '',
      images: [],
      availability: {},
      assignedScenes: [],
      quantity: 1,
      location: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  const handleOpenDialog = (prop?: Prop) => {
    blurFocusedElement();
    if (prop) {
      const effectiveType = getItemType(prop);
      setEditingProp(prop);
      setFormData({ ...prop, itemType: effectiveType, category: getItemCategory(prop, effectiveType) });
    } else {
      const initialType: PropItemType = itemTypeFilter === 'all' ? 'prop' : itemTypeFilter;
      openCreateDialogForType(initialType);
      return;
    }
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) return;
    const id = window.requestAnimationFrame(() => blurFocusedElement());
    return () => window.cancelAnimationFrame(id);
  }, [dialogOpen]);

  useEffect(() => {
    const handleExternalCreateOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ itemType?: PropItemType }>;
      const requestedType: PropItemType = customEvent.detail?.itemType === 'equipment' ? 'equipment' : 'prop';
      setItemTypeFilter(requestedType);
      openCreateDialogForType(requestedType);
    };

    window.addEventListener(OPEN_PROP_CREATE_MODAL_EVENT, handleExternalCreateOpen as EventListener);
    return () => window.removeEventListener(OPEN_PROP_CREATE_MODAL_EVENT, handleExternalCreateOpen as EventListener);
  }, []);

  const convertFileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const imagePromises = files.map(file => {
        if (!file.type.startsWith('image/')) {
          throw new Error(t('prop.err.imageFilesOnly'));
        }
        return convertFileToDataURL(file);
      });
      
      const newImages = await Promise.all(imagePromises);
      setFormData({
        ...formData,
        images: [...(formData.images || []), ...newImages],
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      alert(error instanceof Error ? error.message : t('prop.err.uploadImages'));
    }
    
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = (formData.images || []).filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProp(null);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showError(t('prop.err.nameRequired'));
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const notesText = typeof formData.notes === 'string' ? formData.notes.trim() : '';
      const selectedItemType: PropItemType =
        formData.itemType === 'equipment' ? 'equipment' : formData.itemType === 'prop' ? 'prop' : resolveItemTypeFromCategory(formData.category);
      const fallbackCategory = selectedItemType === 'equipment' ? 'equipment' : 'prop';
      const normalizedCategory = normalizeCategoryKey(formData.category) || fallbackCategory;
      const prop: Prop = editingProp
        ? {
            ...editingProp,
            ...formData,
            itemType: selectedItemType,
            category: normalizedCategory,
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
            id: `prop-${Date.now()}`,
            name: formData.name || '',
            itemType: selectedItemType,
            category: normalizedCategory || 'other',
            description: formData.description,
            availability: formData.availability || {},
            assignedScenes: formData.assignedScenes || [],
            quantity: formData.quantity || 1,
            location: formData.location,
            notes: formData.notes,
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

      await castingService.saveProp(projectId, prop);
      const mentionSeed = [
        formData.name,
        formData.location,
        ...globalTagService.parseExplicitMentions(typeof formData.notes === 'string' ? formData.notes : ''),
      ]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length >= 2);
      if (mentionSeed.length > 0) {
        void globalTagService.add(mentionSeed).catch((error) => {
          console.warn('Could not update global mention register for props:', error);
        });
      }
      const loadedProps = await castingService.getProps(projectId);
      setProps(Array.isArray(loadedProps) ? loadedProps : []);

      // Show success notification
      if (editingProp) {
        showSuccess(t('prop.toast.updated', { name: formData.name }), 3000);
      } else {
        showSuccess(t('prop.toast.added', { name: formData.name }), 3000);
      }

      handleCloseDialog();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving prop:', error);
      showError(t('prop.err.save'));
    }
  };

  const handleDeleteWithUndo = async (propId: string) => {
    const prop = props.find((p) => p.id === propId);
    if (prop) {
      try {
        setDeletedProp(prop);
        await castingService.deleteProp(projectId, propId);
        const loadedProps = await castingService.getProps(projectId);
        setProps(Array.isArray(loadedProps) ? loadedProps : []);
        setUndoSnackbarOpen(true);
        showInfo(t('prop.toast.deleted', { name: prop.name }), 6000);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting prop:', error);
        showError(t('prop.err.delete'));
      }
    }
  };

  const handleUndoDelete = async () => {
    if (deletedProp) {
      try {
        await castingService.saveProp(projectId, deletedProp);
        const loadedProps = await castingService.getProps(projectId);
        setProps(Array.isArray(loadedProps) ? loadedProps : []);
        showSuccess(t('prop.toast.restored', { name: deletedProp.name }), 3000);
        setDeletedProp(null);
        setUndoSnackbarOpen(false);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error undoing delete:', error);
        showError(t('prop.err.restore'));
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
    if (selectedIds.size === filteredAndSortedProps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedProps.map((p) => p.id)));
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
    if (window.confirm(t('prop.confirm.bulkDelete', { n: selectedIds.size }))) {
      try {
        for (const id of selectedIds) {
          await castingService.deleteProp(projectId, id);
        }
        const loadedProps = await castingService.getProps(projectId);
        setProps(Array.isArray(loadedProps) ? loadedProps : []);
        setSelectedIds(new Set());
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting props:', error);
        showError(t('prop.err.bulkDelete'));
      }
    }
  };

  const handleDuplicate = async (prop: Prop) => {
    try {
      const newProp: Prop = {
        ...prop,
        id: `prop-${Date.now()}`,
        name: `${prop.name} ${t('prop.copySuffix')}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveProp(projectId, newProp);
      const loadedProps = await castingService.getProps(projectId);
      setProps(Array.isArray(loadedProps) ? loadedProps : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error duplicating prop:', error);
      showError(t('prop.err.duplicate'));
    }
  };

  const handleExportCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        alert(t('prop.err.projectNotFound'));
        return;
      }

      const htmlContent = generatePropsHTML(project, props);

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert(t('prop.err.exportWindow'));
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error exporting props:', error);
      alert(t('prop.err.export'));
    }
  };

  const generatePropsHTML = (project: any, props: any[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalProps = props.length;
    const propsWithScenes = props.filter((p) => (p.assignedScenes?.length || 0) > 0).length;

    const propIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - ${t('prop.cat.equipment')}</title>
  <style>
    @page { margin: 0; counter-increment: page; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.7; padding: 0; background: #fff; font-size: 14px; }
    .page { padding: 50px 60px 80px 60px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #9333ea; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #9333ea; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #9333ea; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #9333ea; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #9333ea; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #9333ea 0%, #6d28d9 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    td { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 400; vertical-align: top; }
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
        ${propIconSVG}
        ${project.name} - ${t('prop.cat.equipment')}
      </div>
      <div class="subtitle">${t('prop.export.exportedAt', { date: dateStr })}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${propIconSVG}
        ${t('prop.export.overview')}
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalProps}</span>
          <span class="summary-label">${t('prop.export.totalEquipment')}</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${propsWithScenes}</span>
          <span class="summary-label">${t('prop.export.withAssignedScenes')}</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${propIconSVG}</span>${t('prop.cat.equipment')}</div>
        <span class="section-count">${totalProps} ${totalProps !== 1 ? t('prop.export.units') : t('prop.export.unit')}</span>
      </div>
      <div class="section-content">
        ${props.length === 0
          ? `<div class="empty-state">${t('prop.export.noEquipment')}</div>`
          : `<table>
          <thead>
            <tr>
              <th style="width: 18%;">${t('prop.export.colName')}</th>
              <th style="width: 12%;">${t('prop.export.colCategory')}</th>
              <th style="width: 25%;">${t('prop.export.colDescription')}</th>
              <th style="width: 8%;">${t('prop.export.colQuantity')}</th>
              <th style="width: 15%;">${t('prop.export.colLocation')}</th>
              <th style="width: 7%;">${t('prop.export.colScenes')}</th>
              <th style="width: 15%;">${t('prop.export.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            ${props.map((prop) => {
              const description = prop.description || '-';
              const notes = prop.notes || '-';
              return `<tr>
              <td><strong>${prop.name}</strong></td>
              <td>${getCategoryLabel(getItemCategory(prop))}</td>
              <td style="font-size: 13px;">${description.length > 60 ? description.substring(0, 60) + '...' : description}</td>
              <td style="text-align: center;">${(prop.quantity || 1)}</td>
              <td style="font-size: 13px;">${prop.location || '-'}</td>
              <td style="text-align: center;">${prop.assignedScenes?.length || 0}</td>
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
        <span class="page-number">${t('prop.export.page')} </span>
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
      id="role-room-prop-management-panel"
      aria-labelledby="prop-panel-title"
      sx={{
        p: { xs: 2, sm: 3, md: containerPadding },
        borderRadius: { xs: 2, sm: 3 },
        border: '1px solid rgba(147,51,234,0.24)',
        background:
          'radial-gradient(1200px 380px at 10% -10%, rgba(147,51,234,0.16), transparent 55%), linear-gradient(180deg, rgba(23,15,44,0.74) 0%, rgba(12,10,26,0.64) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28)',
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
        }}
      >
        {/* Enhanced Title with gradient - matches ProductionDayView */}
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
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0.15) 100%)',
              border: '2px solid rgba(147, 51, 234, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.2)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(147, 51, 234, 0.3)',
              },
            }}
          >
            <Inventory2Icon
              sx={{
                color: '#c084fc',
                fontSize: { xs: 26, sm: 32, md: 36 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id="prop-panel-title"
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #fff 0%, #c084fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('prop.header.title')}
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
              <CategoryIcon sx={{ fontSize: { xs: 14, sm: 16 }, opacity: 0.7 }} />
              {t('prop.header.subtitle')}
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
          <Tooltip title={t('prop.tip.exportCsv')}>
            <Button
              variant="outlined"
              onClick={handleExportCSV}
              aria-label={t('prop.aria.exportCsv')}
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
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>{t('prop.btn.export')}</Box>}
            </Button>
          </Tooltip>

          <Tooltip title={t('prop.tip.toggleStats')}>
            <Button
              variant="outlined"
              onClick={() => setShowStats(!showStats)}
              aria-pressed={showStats}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: showStats ? '#9333ea' : 'rgba(255,255,255,0.7)',
                borderColor: showStats ? '#9333ea' : 'rgba(255,255,255,0.2)',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
              }}
            >
              <StatsIcon />
            </Button>
          </Tooltip>

          <Tooltip title={t('prop.tip.warehouse')}>
            <Button
              variant="outlined"
              onClick={() => {
                blurFocusedElement();
                setWarehouseDialogOpen(true);
              }}
              aria-label={t('prop.aria.openWarehouse')}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: warehouseIssueCount > 0 ? '#ef5350' : '#c084fc',
                borderColor: warehouseIssueCount > 0 ? '#ef5350' : 'rgba(192,132,252,0.5)',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
                '&:hover': {
                  borderColor: warehouseIssueCount > 0 ? '#ef5350' : '#d8b4fe',
                  bgcolor: warehouseIssueCount > 0 ? 'rgba(239,83,80,0.1)' : 'rgba(192,132,252,0.1)',
                },
              }}
            >
              <Inventory2Icon />
              {!isMobile && (
                <Box component="span" sx={{ ml: 1 }}>
                  {warehouseIssueCount > 0 ? t('prop.btn.warehouseWithCount', { n: warehouseIssueCount }) : t('prop.btn.warehouse')}
                </Box>
              )}
            </Button>
          </Tooltip>

          <Tooltip title={t('prop.tip.addItem')}>
            <Button
              variant="contained"
              onClick={() => handleOpenDialog()}
              aria-label={t('prop.aria.addItem')}
              sx={{
                bgcolor: '#9333ea',
                color: '#fff',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                flex: { xs: 1, sm: 'none' },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#6d28d9' },
              }}
              >
                <AddIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>{t('prop.btn.newItem')}</Box>}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Type + modus kontroll */}
      <Box
        sx={{
          mb: 2,
          p: { xs: 1.25, sm: 1.5 },
          borderRadius: 2,
          border: '1px solid rgba(147,51,234,0.24)',
          bgcolor: 'rgba(18,14,38,0.55)',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
          gap: 1.25,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 600 }}>
            Type:
          </Typography>
          <Button
            size="small"
            variant={itemTypeFilter === 'all' ? 'contained' : 'outlined'}
            onClick={() => setItemTypeFilter('all')}
            sx={{
              minHeight: 34,
              bgcolor: itemTypeFilter === 'all' ? 'rgba(147,51,234,0.2)' : 'transparent',
              borderColor: 'rgba(147,51,234,0.45)',
              color: '#c084fc',
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            {t('prop.filter.all', { n: props.length })}
          </Button>
          <Button
            size="small"
            variant={itemTypeFilter === 'equipment' ? 'contained' : 'outlined'}
            startIcon={<BuildIcon sx={{ fontSize: 16 }} />}
            onClick={() => setItemTypeFilter('equipment')}
            sx={{
              minHeight: 34,
              bgcolor: itemTypeFilter === 'equipment' ? 'rgba(33,150,243,0.24)' : 'transparent',
              borderColor: 'rgba(33,150,243,0.5)',
              color: '#64b5f6',
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            {t('prop.cat.equipment')} ({stats.itemTypeCount.equipment})
          </Button>
          <Button
            size="small"
            variant={itemTypeFilter === 'prop' ? 'contained' : 'outlined'}
            startIcon={<PropsIcon sx={{ fontSize: 16 }} />}
            onClick={() => setItemTypeFilter('prop')}
            sx={{
              minHeight: 34,
              bgcolor: itemTypeFilter === 'prop' ? 'rgba(156,39,176,0.2)' : 'transparent',
              borderColor: 'rgba(192,132,252,0.5)',
              color: '#c084fc',
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            {t('prop.filter.props')} ({stats.itemTypeCount.prop})
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: 600 }}>
            {t('prop.label.workMode')}
          </Typography>
          <Button
            size="small"
            variant={panelMode === 'standard' ? 'contained' : 'outlined'}
            onClick={() => setPanelMode('standard')}
            sx={{
              minHeight: 34,
              bgcolor: panelMode === 'standard' ? 'rgba(147,51,234,0.2)' : 'transparent',
              borderColor: 'rgba(147,51,234,0.45)',
              color: '#c084fc',
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            Standard
          </Button>
          <Button
            size="small"
            variant={panelMode === 'pro' ? 'contained' : 'outlined'}
            onClick={() => setPanelMode('pro')}
            sx={{
              minHeight: 34,
              bgcolor: panelMode === 'pro' ? 'rgba(76,175,80,0.2)' : 'transparent',
              borderColor: 'rgba(76,175,80,0.5)',
              color: '#81c784',
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            {t('prop.mode.pro')}
          </Button>
        </Box>
      </Box>

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
          aria-label={t('prop.aria.stats')}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <PropsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#9333ea' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#9333ea', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.total}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('prop.stat.unique')}</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <Inventory2Icon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#2196f3' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.totalQuantity}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('prop.stat.totalQuantity')}</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.favorites}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('prop.stat.favorites')}</Typography>
          </Box>
          {!isMobile && Object.entries(stats.categoryCount).slice(0, 4).map(([cat, count]) => (
            <Box key={cat} sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: getCategoryColor(cat), fontWeight: 600 }}>
                {count}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {getCategoryLabel(cat)}
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
        }}
      >
        <TextField
          placeholder={isMobile ? t('prop.search.placeholderShort') : t('prop.search.placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1 }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': t('prop.aria.search') },
          }}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#9333ea' },
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          <Tooltip title={t('prop.tip.toggleFilters')}>
            <Button
              variant={showFilters ? 'contained' : 'outlined'}
              onClick={() => setShowFilters(!showFilters)}
              aria-pressed={showFilters}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: showFilters ? 'rgba(147,51,234,0.2)' : 'transparent',
                color: showFilters ? '#9333ea' : 'rgba(255,255,255,0.7)',
                borderColor: showFilters ? '#9333ea' : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <FilterIcon />
            </Button>
          </Tooltip>

          <Tooltip title={t('prop.tip.gridView')}>
            <Button
              variant={viewMode === 'grid' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'grid' ? 'rgba(147,51,234,0.2)' : 'transparent',
                color: viewMode === 'grid' ? '#9333ea' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? '#9333ea' : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <GridViewIcon />
            </Button>
          </Tooltip>

          <Tooltip title={t('prop.tip.tableView')}>
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'table' ? 'rgba(147,51,234,0.2)' : 'transparent',
                color: viewMode === 'table' ? '#9333ea' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? '#9333ea' : 'rgba(255,255,255,0.2)',
                ...focusVisibleStyles,
              }}
            >
              <TableViewIcon />
            </Button>
          </Tooltip>

          {selectedIds.size > 0 && (
            <Tooltip title={t('prop.tip.deleteSelected', { n: selectedIds.size })}>
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

      {/* Filter Panel - Responsive */}
      <Collapse in={showFilters}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 2 },
            mb: 2,
            p: { xs: 1.5, sm: 2 },
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
        >
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('prop.filter.category')}</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label={t('prop.filter.category')}
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <MenuItem value="all">{t('prop.filter.allCategories')}</MenuItem>
              {availableCategories.map((cat) => (
                <MenuItem key={cat} value={cat} sx={{ minHeight: TOUCH_TARGET_SIZE }}>
                  {getCategoryLabel(cat)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {(filterCategory !== 'all' || searchQuery || itemTypeFilter !== 'all') && (
            <Button
              variant="text"
              onClick={() => {
                setItemTypeFilter('all');
                setFilterCategory('all');
                setSearchQuery('');
              }}
              sx={{ color: '#9333ea', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
            >
              {t('prop.btn.reset')}
            </Button>
          )}
        </Box>
      </Collapse>

      {panelMode === 'pro' && (
        <Box
          sx={{
            mb: 2,
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            border: '1px solid rgba(76,175,80,0.28)',
            bgcolor: 'rgba(20,32,28,0.42)',
          }}
        >
          <Typography sx={{ color: '#81c784', fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
            {t('prop.pro.operations')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(76,175,80,0.13)', border: '1px solid rgba(76,175,80,0.3)' }}>
              <Typography sx={{ color: '#a5d6a7', fontSize: '0.72rem', fontWeight: 700 }}>{t('prop.pro.readyForShoot')}</Typography>
              <Typography sx={{ color: '#4caf50', fontWeight: 800, fontSize: '1.1rem' }}>{proMetrics.readyCount}</Typography>
            </Box>
            <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,152,0,0.12)', border: '1px solid rgba(255,152,0,0.3)' }}>
              <Typography sx={{ color: '#ffcc80', fontSize: '0.72rem', fontWeight: 700 }}>{t('prop.pro.missingLocation')}</Typography>
              <Typography sx={{ color: '#ffb74d', fontWeight: 800, fontSize: '1.1rem' }}>{proMetrics.missingLocationCount}</Typography>
            </Box>
            <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(3,169,244,0.12)', border: '1px solid rgba(3,169,244,0.3)' }}>
              <Typography sx={{ color: '#81d4fa', fontSize: '0.72rem', fontWeight: 700 }}>{t('prop.pro.missingScene')}</Typography>
              <Typography sx={{ color: '#4fc3f7', fontWeight: 800, fontSize: '1.1rem' }}>{proMetrics.missingSceneCount}</Typography>
            </Box>
            <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(244,67,54,0.12)', border: '1px solid rgba(244,67,54,0.3)' }}>
              <Typography sx={{ color: '#ef9a9a', fontSize: '0.72rem', fontWeight: 700 }}>
                {t('prop.pro.lowStock')}
              </Typography>
              <Typography sx={{ color: '#ef5350', fontWeight: 800, fontSize: '1.1rem' }}>{proMetrics.lowStockCount}</Typography>
            </Box>
            <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)' }}>
              <Typography sx={{ color: '#a5d6a7', fontSize: '0.72rem', fontWeight: 700 }}>
                {t('prop.pro.stockAvailable')}
              </Typography>
              <Typography sx={{ color: '#81c784', fontWeight: 800, fontSize: '1.1rem' }}>{warehouseTotals.available}</Typography>
            </Box>
            <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,183,77,0.12)', border: '1px solid rgba(255,183,77,0.3)' }}>
              <Typography sx={{ color: '#ffcc80', fontSize: '0.72rem', fontWeight: 700 }}>
                {t('prop.pro.stockDiscrepancy')}
              </Typography>
              <Typography sx={{ color: '#ffb74d', fontWeight: 800, fontSize: '1.1rem' }}>{warehouseIssueCount}</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Results count */}
      {(searchQuery || filterCategory !== 'all' || itemTypeFilter !== 'all') && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(147,51,234,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#9333ea' },
          }}
        >
          {t('prop.results.showing', { shown: filteredAndSortedProps.length, total: props.length })}
        </Alert>
      )}

      {/* Empty state */}
      {props.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={equipPng}
          title={t('prop.empty.title')}
          subtitle={t('prop.empty.subtitle')}
          color="#9333ea"
        />
      ) : filteredAndSortedProps.length === 0 ? (
        <Box role="status" sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.87)' }}>
          <SearchIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
          <Typography variant="body1">{t('prop.empty.noResults')}</Typography>
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
          <Table aria-label={t('prop.aria.tableItems')} sx={{ minWidth: { xs: 600, sm: 'auto' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedProps.length && filteredAndSortedProps.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedProps.length}
                    onChange={handleSelectAll}
                    aria-label={t('prop.aria.selectAll')}
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#9333ea' } }}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >{t('prop.col.name')}</TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'category'}
                    direction={sortField === 'category' ? sortDirection : 'asc'}
                    onClick={() => handleSort('category')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >{t('prop.col.category')}</TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'quantity'}
                    direction={sortField === 'quantity' ? sortDirection : 'asc'}
                    onClick={() => handleSort('quantity')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >{t('prop.col.quantity')}</TableSortLabel>
                </TableCell>
                <TableCell>{t('prop.col.stockStatus')}</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>{t('prop.col.location')}</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'scenes'}
                    direction={sortField === 'scenes' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scenes')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >{t('prop.col.scenes')}</TableSortLabel>
                </TableCell>
                <TableCell align="right">{t('prop.col.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedProps.map((prop) => {
                const effectiveType = getItemType(prop);
                const effectiveCategory = getItemCategory(prop, effectiveType);
                const warehouseTotalsForItem = warehouseStockByItem[prop.id];
                return (
                <TableRow
                  key={prop.id}
                  sx={{
                    bgcolor: selectedIds.has(prop.id) ? 'rgba(147,51,234,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(prop.id)}
                      onChange={() => handleToggleSelect(prop.id)}
                      inputProps={{ 'aria-label': t('prop.aria.selectItem', { name: prop.name }) }}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#9333ea' } }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {favorites.has(prop.id) && <StarIcon sx={{ color: '#ffc107', fontSize: 16 }} />}
                      <Typography sx={{ color: '#fff' }}>{prop.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getCategoryLabel(effectiveCategory)}
                      size="small"
                      sx={{ bgcolor: `${getCategoryColor(effectiveCategory)}33`, color: getCategoryColor(effectiveCategory) }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {prop.quantity || 1}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {warehouseTotalsForItem ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        <Chip
                          label={t('prop.chip.availShort', { n: warehouseTotalsForItem.available })}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(76,175,80,0.15)',
                            color: '#81c784',
                            border: '1px solid rgba(76,175,80,0.35)',
                            fontWeight: 700,
                            fontSize: '0.68rem',
                          }}
                        />
                        <Chip
                          label={t('prop.chip.resShort', { n: warehouseTotalsForItem.reserved })}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,183,77,0.15)',
                            color: '#ffb74d',
                            border: '1px solid rgba(255,183,77,0.35)',
                            fontWeight: 700,
                            fontSize: '0.68rem',
                          }}
                        />
                      </Stack>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getItemTypeLabel(effectiveType)}
                      size="small"
                      sx={{
                        bgcolor: effectiveType === 'equipment' ? 'rgba(100,181,246,0.2)' : 'rgba(192,132,252,0.2)',
                        color: effectiveType === 'equipment' ? '#64b5f6' : '#c084fc',
                        border: `1px solid ${effectiveType === 'equipment' ? 'rgba(100,181,246,0.5)' : 'rgba(192,132,252,0.5)'}`,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.875rem' }}>
                      {prop.location || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {prop.assignedScenes?.length || 0}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title={favorites.has(prop.id) ? t('prop.tip.removeFavorite') : t('prop.tip.favorite')}>
                        <IconButton
                          onClick={() => toggleFavorite(prop.id)}
                          aria-label={favorites.has(prop.id) ? t('prop.aria.removeFromFavorites', { name: prop.name }) : t('prop.aria.addToFavorites', { name: prop.name })}
                          sx={{ color: favorites.has(prop.id) ? '#ffc107' : 'rgba(255,255,255,0.3)' }}
                        >
                          {favorites.has(prop.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('prop.tip.duplicate')}>
                        <IconButton
                          onClick={() => handleDuplicate(prop)}
                          aria-label={t('prop.aria.duplicate', { name: prop.name })}
                          sx={{ color: 'rgba(255,255,255,0.87)' }}
                        >
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('prop.tip.edit')}>
                        <IconButton
                          onClick={() => handleOpenDialog(prop)}
                          aria-label={t('prop.aria.edit', { name: prop.name })}
                          sx={{ color: '#9333ea' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('prop.tip.delete')}>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(prop.id)}
                          aria-label={t('prop.aria.delete', { name: prop.name })}
                          sx={{ color: '#ff4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Kortvisning - CSS Grid */
        <Box
          role="list"
          aria-label={t('prop.aria.itemsList')}
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: panelMode === 'pro' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
            },
            gap: { xs: 2, sm: 2.5, md: 3 },
            alignItems: 'stretch',
          }}
        >
          {filteredAndSortedProps.map((prop) => {
            const itemType = getItemType(prop);
            const effectiveCategory = getItemCategory(prop, itemType);
            const categoryColor = getCategoryColor(effectiveCategory);
            const itemTypeColor = itemType === 'equipment' ? '#64b5f6' : '#c084fc';
            const warehouseTotalsForItem = warehouseStockByItem[prop.id];
            return (
            <Box key={prop.id} role="listitem" sx={{ minWidth: 0 }}>
              <Card
                component="article"
                aria-labelledby={`prop-name-${prop.id}`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: selectedIds.has(prop.id) ? 'rgba(147,51,234,0.08)' : 'rgba(255,255,255,0.03)',
                  border: selectedIds.has(prop.id) ? '2px solid #9333ea' : '2px solid rgba(147,51,234,0.2)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  ...focusVisibleStyles,
                  '&:hover': {
                    borderColor: 'rgba(147,51,234,0.6)',
                    boxShadow: '0 8px 24px rgba(147,51,234,0.25)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {/* Image Header with Overlay */}
                <Box sx={{ position: 'relative' }}>
                  {prop.modelUrl ? (
                    <Box
                      sx={{
                        width: '100%',
                        height: { xs: 160, sm: 180, md: 200 },
                        bgcolor: 'rgba(15,20,30,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <GLB3DPreview _src={prop.modelUrl} height={200} />
                    </Box>
                  ) : prop.images && prop.images.length > 0 ? (
                    <Box
                      component="img"
                      src={prop.images[0]}
                      alt={prop.name}
                      sx={{
                        width: '100%',
                        height: { xs: 160, sm: 180, md: 200 },
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: { xs: 160, sm: 180, md: 200 },
                        background: 'linear-gradient(135deg, rgba(147,51,234,0.25) 0%, rgba(147,51,234,0.15) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 70, sm: 80, md: 90 },
                          height: { xs: 70, sm: 80, md: 90 },
                          borderRadius: 3,
                          bgcolor: 'rgba(147,51,234,0.30)',
                          border: '3px solid rgba(147,51,234,0.50)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 24px rgba(147,51,234,0.30)',
                        }}
                      >
                        <Inventory2Icon sx={{ fontSize: { xs: 36, sm: 42, md: 48 }, color: '#9333ea' }} />
                      </Box>
                    </Box>
                  )}

                  {/* Overlay with kategori/type og favoritt */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      p: 1.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Checkbox
                        checked={selectedIds.has(prop.id)}
                        onChange={() => handleToggleSelect(prop.id)}
                        inputProps={{ 'aria-label': t('prop.aria.selectItem', { name: prop.name }) }}
                        sx={{
                          p: 0.5,
                          color: 'rgba(255,255,255,0.87)',
                          '&.Mui-checked': { color: '#9333ea' },
                        }}
                      />
                      <Stack direction="row" spacing={0.75}>
                        <Chip
                          label={getCategoryLabel(effectiveCategory)}
                          size="small"
                          sx={{
                            bgcolor: `${categoryColor}dd`,
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            height: 24,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          }}
                        />
                        <Chip
                          label={getItemTypeLabel(itemType)}
                          size="small"
                          sx={{
                            bgcolor: `${itemTypeColor}26`,
                            color: itemTypeColor,
                            border: `1px solid ${itemTypeColor}66`,
                            fontWeight: 700,
                            fontSize: '0.68rem',
                            height: 24,
                          }}
                        />
                      </Stack>
                    </Box>
                    <IconButton
                      onClick={() => toggleFavorite(prop.id)}
                      aria-label={favorites.has(prop.id) ? t('prop.tip.removeFavorite') : t('prop.tip.addFavorite')}
                      sx={{
                        color: favorites.has(prop.id) ? '#ffc107' : 'rgba(255,255,255,0.7)',
                        bgcolor: 'rgba(0,0,0,0.3)',
                        minWidth: TOUCH_TARGET_SIZE,
                        minHeight: TOUCH_TARGET_SIZE,
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
                      }}
                    >
                      {favorites.has(prop.id) ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                  </Box>

                  {/* Image count badge */}
                  {prop.images && prop.images.length > 1 && (
                    <Chip
                      icon={<PhotoIcon sx={{ fontSize: 14, color: '#fff !important' }} />}
                      label={prop.images.length}
                      size="small"
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        height: 26,
                      }}
                    />
                  )}
                </Box>

                <CardContent sx={{ p: { xs: 2, sm: 2.5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Name */}
                  <Typography
                    variant="h6"
                    component="h3"
                    id={`prop-name-${prop.id}`}
                    sx={{
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: { xs: '1.1rem', sm: '1.2rem' },
                      mb: 1,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {prop.name}
                  </Typography>

                  {/* Quantity Badge */}
                  {prop.quantity && prop.quantity > 1 && (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        mb: 1.5,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(139,92,246,0.15)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        alignSelf: 'flex-start',
                      }}
                    >
                      <InventoryIcon sx={{ fontSize: 16, color: '#a78bfa' }} />
                      <Typography sx={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 700 }}>
                        {t('prop.card.pieces', { n: prop.quantity })}
                      </Typography>
                    </Box>
                  )}

                  {warehouseTotalsForItem && (
                    <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip
                        label={t('prop.chip.available', { n: warehouseTotalsForItem.available })}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(76,175,80,0.15)',
                          color: '#81c784',
                          border: '1px solid rgba(76,175,80,0.35)',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                        }}
                      />
                      <Chip
                        label={t('prop.chip.reserved', { n: warehouseTotalsForItem.reserved })}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,183,77,0.15)',
                          color: '#ffb74d',
                          border: '1px solid rgba(255,183,77,0.35)',
                          fontWeight: 700,
                          fontSize: '0.7rem',
                        }}
                      />
                    </Stack>
                  )}

                  {/* Description */}
                  {prop.description && (
                    <Typography
                      sx={{
                        color: 'rgba(255,255,255,0.87)',
                        mb: 1.5,
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: expandedCards.has(prop.id) ? 'unset' : 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {prop.description}
                    </Typography>
                  )}

                  {/* Location Info Card */}
                  {prop.location && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        mb: 1.5,
                        borderRadius: 2,
                        bgcolor: 'rgba(76,175,80,0.1)',
                        border: '1px solid rgba(76,175,80,0.25)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1.5,
                          bgcolor: 'rgba(76,175,80,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LocationIcon sx={{ fontSize: 20, color: '#81c784' }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('prop.card.storageLocation')}</Typography>
                        <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prop.location}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Assigned scenes badge */}
                  {(prop.assignedScenes?.length || 0) > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        mb: 1.5,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(147,51,234,0.1)',
                        border: '1px solid rgba(147,51,234,0.3)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1,
                          bgcolor: 'rgba(147,51,234,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CategoryIcon sx={{ fontSize: 16, color: '#c084fc' }} />
                      </Box>
                      <Typography sx={{ color: '#c084fc', fontSize: '0.8rem', fontWeight: 600 }}>
                        {t('prop.card.scenesAssigned', { n: prop.assignedScenes?.length || 0 })}
                      </Typography>
                    </Box>
                  )}

                  {/* Expandable section */}
                  <Collapse in={expandedCards.has(prop.id)}>
                    <Box sx={{ mt: 1, pt: 2, borderTop: '2px solid rgba(147,51,234,0.2)' }}>
                      {prop.notes && (
                        <Box
                          sx={{
                            p: 1.5,
                            mb: 1.5,
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        >
                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>{t('prop.card.notes')}</Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            {prop.notes}
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', mt: 0.55 }}>
                            {t('prop.card.writtenBy')}{' '}
                            {(() => {
                              const rawAuthor =
                                prop.notesAuthorName
                                ?? prop.notesAuthor
                                ?? prop.notesBy;
                              return typeof rawAuthor === 'string' && rawAuthor.trim().length > 0
                                ? rawAuthor.trim()
                                : t('prop.card.notRegistered');
                            })()}
                            {(() => {
                              const rawUpdatedAt =
                                prop.notesUpdatedAt
                                ?? prop.notesLastEditedAt
                                ?? prop.notesTimestamp;
                              const updatedText = formatPropNoteTimestamp(rawUpdatedAt);
                              return updatedText ? ` • ${updatedText}` : '';
                            })()}
                          </Typography>
                        </Box>
                      )}

                      {/* Additional images */}
                      {prop.images && prop.images.length > 1 && (
                        <Box>
                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
                            {t('prop.card.moreImages', { n: prop.images.length })}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {prop.images.slice(1, 5).map((image, idx) => (
                              <Box
                                key={idx}
                                component="img"
                                src={image}
                                alt={`${prop.name} ${idx + 2}`}
                                sx={{
                                  width: { xs: 56, sm: 64 },
                                  height: { xs: 56, sm: 64 },
                                  objectFit: 'cover',
                                  borderRadius: 1.5,
                                  border: '2px solid rgba(147,51,234,0.3)',
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    transform: 'scale(1.05)',
                                    borderColor: '#9333ea',
                                  },
                                }}
                              />
                            ))}
                            {prop.images.length > 5 && (
                              <Box
                                sx={{
                                  width: { xs: 56, sm: 64 },
                                  height: { xs: 56, sm: 64 },
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: 'rgba(147,51,234,0.15)',
                                  borderRadius: 1.5,
                                  border: '2px solid rgba(147,51,234,0.3)',
                                }}
                              >
                                <Typography sx={{ color: '#c084fc', fontWeight: 700, fontSize: '0.9rem' }}>
                                  +{prop.images.length - 5}
                                </Typography>
                              </Box>
                            )}
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
                      pt: { xs: 2, sm: 2.5 },
                      mt: 'auto',
                      borderTop: '2px solid rgba(147,51,234,0.2)',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="medium"
                      onClick={() => toggleCardExpanded(prop.id)}
                      endIcon={expandedCards.has(prop.id) ? <CollapseIcon /> : <ExpandIcon />}
                      aria-expanded={expandedCards.has(prop.id)}
                      aria-label={expandedCards.has(prop.id) ? t('prop.card.hideDetails') : t('prop.card.showMore')}
                      sx={{
                        bgcolor: expandedCards.has(prop.id) ? 'rgba(147,51,234,0.25)' : 'rgba(147,51,234,0.15)',
                        color: expandedCards.has(prop.id) ? '#c084fc' : '#fff',
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                        fontWeight: 600,
                        minHeight: TOUCH_TARGET_SIZE,
                        px: { xs: 2, sm: 2.5 },
                        border: expandedCards.has(prop.id) ? '2px solid rgba(147,51,234,0.5)' : '2px solid rgba(147,51,234,0.3)',
                        borderRadius: 2,
                        textTransform: 'none',
                        boxShadow: expandedCards.has(prop.id) ? '0 4px 12px rgba(147,51,234,0.3)' : '0 2px 8px rgba(147,51,234,0.2)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(147,51,234,0.35)',
                          borderColor: 'rgba(147,51,234,0.6)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 6px 16px rgba(147,51,234,0.4)',
                        },
                        ...focusVisibleStyles,
                      }}
                    >
                      {expandedCards.has(prop.id) ? t('prop.card.hideDetails') : t('prop.card.showDetails')}
                    </Button>
                    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 } }}>
                      <Tooltip title={t('prop.tip.duplicate')} arrow>
                        <IconButton
                          onClick={() => handleDuplicate(prop)}
                          aria-label={t('prop.aria.duplicate', { name: prop.name })}
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
                      <Tooltip title={t('prop.tip.edit')} arrow>
                        <IconButton
                          onClick={() => handleOpenDialog(prop)}
                          aria-label={t('prop.aria.edit', { name: prop.name })}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: '#c084fc',
                            '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('prop.tip.delete')} arrow>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(prop.id)}
                          aria-label={t('prop.aria.delete', { name: prop.name })}
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
      )}

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message={t('prop.snackbar.deleted', { name: deletedProp?.name ?? '' })}
        action={
          <Button color="primary" size="small" onClick={handleUndoDelete} sx={{ color: '#9333ea' }}>{t('prop.btn.undo')}</Button>
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
              bgcolor: '#1c2128',
              color: '#fff',
              maxHeight: { xs: '100%', sm: '90vh' },
              m: { xs: 0, sm: 2, md: 3 },
              borderRadius: { xs: 0, sm: 2 },
              zIndex: 100000,
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
            },
          },
        }}
        sx={{
          zIndex: 100000,
          '& .MuiBackdrop-root': {
            zIndex: 99998,
            bgcolor: 'rgba(0,0,0,0.8)',
            willChange: 'opacity',
          },
        }}
      >
        <DialogTitle
          component="div"
          id={dialogTitleId}
          sx={{
            color: '#fff',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: { xs: 1.5, sm: 2 },
            px: { xs: 2, sm: 3 },
          }}
        >
          {editingProp ? t('prop.dialog.editTitle') : t('prop.dialog.newTitle')}
          {isMobile && (
            <IconButton onClick={handleCloseDialog} aria-label={t('prop.aria.closeDialog')} sx={{ color: 'rgba(255,255,255,0.87)', mr: -1 }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 }, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Typography id={dialogDescId} variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
            {t('prop.dialog.description')}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2.5,
              alignItems: 'start',
            }}
          >
            <TextField
              label={t('prop.field.name')}
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
                gridColumn: '1 / -1',
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#9333ea' },
              }}
            />

            <FormControl
              fullWidth
              sx={{
                gridColumn: { xs: '1 / -1', sm: '1 / span 1' },
              }}
            >
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Type</InputLabel>
              <Select
                value={formItemType}
                onChange={(e) => {
                  const nextType = e.target.value as PropItemType;
                  const nextOptions = CATEGORY_DEFINITIONS.filter((category) => category.itemType === nextType).map(
                    (category) => category.key
                  );
                  const currentCategory = normalizeCategoryKey(formData.category);
                  const nextCategory = nextOptions.includes(currentCategory) ? currentCategory : nextOptions[0] || '';
                  setFormData({ ...formData, itemType: nextType, category: nextCategory });
                }}
                label="Type"
                MenuProps={selectMenuProps}
                sx={{
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                }}
              >
                <MenuItem value="equipment" sx={{ minHeight: TOUCH_TARGET_SIZE }}>{t('prop.cat.equipment')}</MenuItem>
                <MenuItem value="prop" sx={{ minHeight: TOUCH_TARGET_SIZE }}>{t('prop.cat.prop')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl
              fullWidth
              sx={{
                gridColumn: { xs: '1 / -1', sm: '2 / span 1' },
              }}
            >
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>{t('prop.field.category')}</InputLabel>
              <Select
                value={normalizeCategoryKey(formData.category)}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                label={t('prop.field.category')}
                MenuProps={selectMenuProps}
                sx={{
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                }}
              >
                {formCategoryOptions.map((cat) => (
                  <MenuItem key={cat} value={cat} sx={{ minHeight: TOUCH_TARGET_SIZE }}>
                    {getCategoryLabel(cat)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t('prop.field.description')}
              fullWidth
              multiline
              rows={2}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                    <NotesIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                gridColumn: '1 / -1',
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            {/* Image Upload Section */}
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <ImageIcon sx={{ color: '#9333ea', fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                <Typography variant="subtitle2" sx={{ color: '#9333ea', fontWeight: 600 }}>{t('prop.field.images')}</Typography>
              </Box>
              
              {/* Existing images */}
              {formData.images && formData.images.length > 0 && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, minmax(0, 1fr))',
                      sm: 'repeat(auto-fill, minmax(120px, 1fr))',
                    },
                    gap: 1.5,
                    mb: 2,
                  }}
                >
                  {formData.images.map((image, index) => (
                    <Box
                      key={index}
                      sx={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <Box
                        component="img"
                        src={image}
                        alt={t('prop.aria.image', { n: index + 1 })}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveImage(index)}
                        aria-label={t('prop.aria.removeImage', { n: index + 1 })}
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          bgcolor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                          width: 32,
                          height: 32,
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Upload button */}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
                id="prop-image-upload"
              />
              <label htmlFor="prop-image-upload">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  sx={{
                    borderColor: 'rgba(147,51,234,0.5)',
                    color: '#9333ea',
                    py: 1.5,
                    minHeight: TOUCH_TARGET_SIZE,
                    '&:hover': {
                      borderColor: '#9333ea',
                      bgcolor: 'rgba(147,51,234,0.1)',
                    },
                  }}
                >{t('prop.btn.uploadImages')}</Button>
              </label>
            </Box>

            <TextField
              label={t('prop.field.quantity')}
              fullWidth
              type="number"
              value={formData.quantity || 1}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              slotProps={{ htmlInput: { min: 1 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <QuantityIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                gridColumn: { xs: '1 / -1', sm: '1 / span 1' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            <TextField
              label={t('prop.field.location')}
              fullWidth
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <StorageIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                gridColumn: { xs: '1 / -1', sm: '2 / span 1' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            <TextField
              label={t('prop.field.notes')}
              fullWidth
              multiline
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                    <NotesIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                gridColumn: '1 / -1',
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>
              {t('prop.card.writtenBy')}{' '}
              {(() => {
                const rawAuthor =
                  formData.notesAuthorName
                  ?? formData.notesAuthor
                  ?? formData.notesBy;
                return typeof rawAuthor === 'string' && rawAuthor.trim().length > 0
                  ? rawAuthor.trim()
                  : t('prop.card.notRegistered');
              })()}
              {(() => {
                const rawUpdatedAt =
                  formData.notesUpdatedAt
                  ?? formData.notesLastEditedAt
                  ?? formData.notesTimestamp;
                const updatedText = formatPropNoteTimestamp(rawUpdatedAt);
                return updatedText ? ` • ${updatedText}` : '';
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
          </Box>
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
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
          >{t('prop.btn.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={<SaveIcon />}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#9333ea',
              color: '#fff',
              fontWeight: 600,
              minHeight: TOUCH_TARGET_SIZE,
              ...focusVisibleStyles,
              '&:hover': { bgcolor: '#6d28d9' },
            }}
          >{t('prop.btn.save')}</Button>
        </DialogActions>
      </Dialog>

      <WarehouseInventoryDialog
        open={warehouseDialogOpen}
        onClose={() => {
          setWarehouseDialogOpen(false);
          refreshWarehouseSummary();
        }}
        projectId={projectId}
        title={t('prop.warehouse.dialogTitle')}
        items={warehouseDialogItems}
        locationSeeds={warehouseLocationSeeds}
        onRequestEditItem={(item) => {
          const target = props.find((entry) => entry.id === item.id);
          if (!target) return;
          setWarehouseDialogOpen(false);
          handleOpenDialog(target);
        }}
      />
    </Box>
  );
}
