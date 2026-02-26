import React, { useState, useMemo, useEffect, useId, useCallback } from 'react';
import { ContextualNudgeBanner } from './ContextualNudgeBanner';
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
  Grid,
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
  Fade,
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
  Check as CheckIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Image as ImageIcon,
  Photo as PhotoIcon,
  PhotoCamera as PhotoCameraIcon,
  CloudUpload as CloudUploadIcon,
  Inventory as InventoryIcon,
  Inventory2 as Inventory2Icon,
  LibraryBooks as LibraryIcon,
  AutoFixHigh as SketchIcon,
  ViewInAr as Model3DIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
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
  CategoryCustomIcon,
} from './icons/CastingIcons';
import { Prop } from '../models/casting';
import { castingService } from '../services/castingService';
import { useToast } from './ToastStack';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import equipPng from './icons/Keep/roleroom_equip.png';
import { GLB3DPreview } from './GLB3DPreview';
import {
  PROP_DESIGN_LIBRARY_UPDATED_EVENT,
  propDesignLibraryService,
  PropAssetStage,
  PropDesignAsset,
  PropStarterTemplate,
} from '../services/propDesignLibraryService';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #9333ea',
    outlineOffset: 2,
  },
};

const DESIGN_STAGE_LABELS: Record<PropAssetStage, string> = {
  sketch: 'Sketch',
  design: 'Design',
  reference: 'Reference',
  final: 'Final',
};

const DESIGN_STAGE_COLORS: Record<PropAssetStage, string> = {
  sketch: '#22d3ee',
  design: '#818cf8',
  reference: '#f59e0b',
  final: '#22c55e',
};

type SortField = 'name' | 'category' | 'quantity' | 'scenes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

interface PropManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
}

export function PropManagementPanel({ projectId, onUpdate }: PropManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();

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

  const starterTemplates = useMemo<PropStarterTemplate[]>(
    () => propDesignLibraryService.getStarterTemplates(),
    []
  );

  const starterCategories = useMemo(() => {
    const categories = Array.from(new Set(starterTemplates.map((template) => template.category)));
    return ['all', ...categories];
  }, [starterTemplates]);

  const reloadDesignLibrary = useCallback(async () => {
    if (!projectId) return;
    try {
      const nextAssetsByProp = await propDesignLibraryService.getAssetsByProp(projectId);
      setAssetsByProp(nextAssetsByProp);
    } catch (error) {
      console.error('Error loading prop design library:', error);
      setAssetsByProp({});
    }
  }, [projectId]);

  useEffect(() => {
    void reloadDesignLibrary();
  }, [reloadDesignLibrary]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLibraryUpdate = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (!detail || typeof detail !== 'object') return;
      const detailProjectId = 'projectId' in detail ? detail.projectId : null;
      if (detailProjectId === projectId) {
        void reloadDesignLibrary();
      }
    };

    window.addEventListener(PROP_DESIGN_LIBRARY_UPDATED_EVENT, handleLibraryUpdate);
    return () => {
      window.removeEventListener(PROP_DESIGN_LIBRARY_UPDATED_EVENT, handleLibraryUpdate);
    };
  }, [projectId, reloadDesignLibrary]);

  const getPropAssets = useCallback((propId: string): PropDesignAsset[] => (
    assetsByProp[propId] ?? []
  ), [assetsByProp]);

  const getPropStageCounts = useCallback((propId: string): Record<PropAssetStage, number> => (
    getPropAssets(propId).reduce<Record<PropAssetStage, number>>((acc, asset) => {
      acc[asset.stage] += 1;
      return acc;
    }, { sketch: 0, design: 0, reference: 0, final: 0 })
  ), [getPropAssets]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<Prop | null>(null);
  const [formData, setFormData] = useState<Partial<Prop>>({
    name: '',
    category: '',
    description: '',
    images: [],
    availability: {},
    assignedScenes: [],
    quantity: 1,
    location: '',
    notes: '',
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showStats, setShowStats] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Favorites with database sync
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Load favorites from database
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
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
        const { favoritesApi } = await import('@/services/castingApiService');
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
  const [modelPreviewProp, setModelPreviewProp] = useState<Prop | null>(null);
  const [assetsByProp, setAssetsByProp] = useState<Record<string, PropDesignAsset[]>>({});
  const [libraryDialogProp, setLibraryDialogProp] = useState<Prop | null>(null);
  const [libraryStageFilter, setLibraryStageFilter] = useState<PropAssetStage | 'all'>('all');
  const [starterDialogOpen, setStarterDialogOpen] = useState(false);
  const [starterQuery, setStarterQuery] = useState('');
  const [starterCategory, setStarterCategory] = useState('all');

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

  const commonCategories = [
    'furniture',
    'decoration',
    'costume',
    'equipment',
    'vehicle',
    'food',
    'other',
  ];

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      furniture: 'Møbler',
      decoration: 'Dekorasjon',
      costume: 'Kostyme',
      equipment: 'Utstyr',
      vehicle: 'Kjøretøy',
      food: 'Mat',
      other: 'Annet',
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      furniture: '#8b4513',
      decoration: '#9c27b0',
      costume: '#e91e63',
      equipment: '#2196f3',
      vehicle: '#607d8b',
      food: '#4caf50',
      other: '#9333ea',
    };
    return colors[category] || '#9333ea';
  };

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

  // Filtered and sorted props
  const filteredAndSortedProps = useMemo(() => {
    let result = [...props];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          getCategoryLabel(p.category).toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.location?.toLowerCase().includes(query) ||
          p.notes?.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter((p) => p.category === filterCategory);
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
          comparison = getCategoryLabel(a.category).localeCompare(getCategoryLabel(b.category), 'nb');
          break;
        case 'quantity':
          comparison = (a.quantity || 1) - (b.quantity || 1);
          break;
        case 'scenes':
          comparison = a.assignedScenes.length - b.assignedScenes.length;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [props, searchQuery, filterCategory, sortField, sortDirection, favorites]);

  // Statistics
  const stats = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    let totalQuantity = 0;

    props.forEach((prop) => {
      categoryCount[prop.category] = (categoryCount[prop.category] || 0) + 1;
      totalQuantity += prop.quantity || 1;
    });

    return {
      total: props.length,
      totalQuantity,
      categoryCount,
      favorites: favorites.size,
    };
  }, [props, favorites]);

  const filteredStarterTemplates = useMemo(() => {
    const query = starterQuery.trim().toLowerCase();
    return starterTemplates.filter((starter) => {
      if (starterCategory !== 'all' && starter.category !== starterCategory) {
        return false;
      }
      if (!query) return true;
      return (
        starter.name.toLowerCase().includes(query) ||
        starter.description.toLowerCase().includes(query) ||
        starter.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [starterCategory, starterQuery, starterTemplates]);

  const libraryDialogAssets = useMemo(() => {
    if (!libraryDialogProp) return [];
    const assets = getPropAssets(libraryDialogProp.id);
    if (libraryStageFilter === 'all') return assets;
    return assets.filter((asset) => asset.stage === libraryStageFilter);
  }, [getPropAssets, libraryDialogProp, libraryStageFilter]);

  // Handlers
  const handleOpenDialog = (prop?: Prop) => {
    if (prop) {
      setEditingProp(prop);
      setFormData(prop);
    } else {
      setEditingProp(null);
      setFormData({
        name: '',
        category: '',
        description: '',
        images: [],
        availability: {},
        assignedScenes: [],
        quantity: 1,
        location: '',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

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
          throw new Error('Vennligst velg bare bildefiler');
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
      alert(error instanceof Error ? error.message : 'Kunne ikke laste opp bilder');
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

  const handleCreatePropFromStarter = useCallback(async (starter: PropStarterTemplate) => {
    if (!projectId) return;
    try {
      const createdProp = await propDesignLibraryService.createPropFromStarter(projectId, starter);
      await propDesignLibraryService.addAsset(projectId, {
        propId: createdProp.id,
        stage: 'reference',
        title: `${starter.name} starter`,
        imageUrl: starter.previewImageUrl,
        source: 'starter',
        tags: starter.tags,
      });
      const loadedProps = await castingService.getProps(projectId);
      setProps(Array.isArray(loadedProps) ? loadedProps : []);
      await reloadDesignLibrary();
      showSuccess(`✅ ${createdProp.name} opprettet fra starterbibliotek`);
    } catch (error) {
      console.error('Error creating prop from starter:', error);
      showError('Kunne ikke opprette rekvisitt fra starter');
    }
  }, [projectId, reloadDesignLibrary, showError, showSuccess]);

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showError('⚠️ Navn er påkrevd');
      return;
    }

    try {
      const prop: Prop = editingProp
        ? { ...editingProp, ...formData, updatedAt: new Date().toISOString() }
        : {
            id: `prop-${Date.now()}`,
            name: formData.name || '',
            category: formData.category || 'other',
            description: formData.description,
            availability: formData.availability || {},
            assignedScenes: formData.assignedScenes || [],
            quantity: formData.quantity || 1,
            location: formData.location,
            notes: formData.notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      await castingService.saveProp(projectId, prop);
      const loadedProps = await castingService.getProps(projectId);
      setProps(Array.isArray(loadedProps) ? loadedProps : []);
      await reloadDesignLibrary();

      // Show success notification
      if (editingProp) {
        showSuccess(`✅ ${formData.name} oppdatert`, 3000);
      } else {
        showSuccess(`📦 ${formData.name} lagt til`, 3000);
      }

      handleCloseDialog();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving prop:', error);
      showError('Feil ved lagring av rekvisitt');
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
        await reloadDesignLibrary();
        setUndoSnackbarOpen(true);
        showInfo(`🗑️ ${prop.name} slettet - klikk "Angre" for å gjenopprette`, 6000);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting prop:', error);
        showError('Feil ved sletting av rekvisitt');
      }
    }
  };

  const handleUndoDelete = async () => {
    if (deletedProp) {
      try {
        await castingService.saveProp(projectId, deletedProp);
        const loadedProps = await castingService.getProps(projectId);
        setProps(Array.isArray(loadedProps) ? loadedProps : []);
        await reloadDesignLibrary();
        showSuccess(`↩️ ${deletedProp.name} gjenopprettet`, 3000);
        setDeletedProp(null);
        setUndoSnackbarOpen(false);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error undoing delete:', error);
        showError('Feil ved gjenoppretting av rekvisitt');
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
    if (window.confirm(`Er du sikker på at du vil slette ${selectedIds.size} rekvisitt(er)?`)) {
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
        showError('Feil ved sletting av rekvisitter');
      }
    }
  };

  const handleDuplicate = async (prop: Prop) => {
    try {
      const newProp: Prop = {
        ...prop,
        id: `prop-${Date.now()}`,
        name: `${prop.name} (kopi)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveProp(projectId, newProp);
      const loadedProps = await castingService.getProps(projectId);
      setProps(Array.isArray(loadedProps) ? loadedProps : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error duplicating prop:', error);
      showError('Feil ved duplisering av rekvisitt');
    }
  };

  const handleExportCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        alert('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generatePropsHTML(project, props);

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
      console.error('Error exporting props:', error);
      alert('Kunne ikke eksportere rekvisitter');
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
    const propsWithScenes = props.filter(p => p.assignedScenes.length > 0).length;

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
  <title>${project.name} - Utstyr</title>
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
        ${project.name} - Utstyr
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${propIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalProps}</span>
          <span class="summary-label">Totalt Utstyr</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${propsWithScenes}</span>
          <span class="summary-label">Med Tildelte Scener</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${propIconSVG}</span>
          Utstyr
        </div>
        <span class="section-count">${totalProps} ${totalProps !== 1 ? 'enheter' : 'enhet'}</span>
      </div>
      <div class="section-content">
        ${props.length === 0
          ? '<div class="empty-state">Ingen utstyr ennå</div>'
          : `<table>
          <thead>
            <tr>
              <th style="width: 18%;">Navn</th>
              <th style="width: 12%;">Kategori</th>
              <th style="width: 25%;">Beskrivelse</th>
              <th style="width: 8%;">Antall</th>
              <th style="width: 15%;">Lagringssted</th>
              <th style="width: 7%;">Scener</th>
              <th style="width: 15%;">Notater</th>
            </tr>
          </thead>
          <tbody>
            ${props.map((prop) => {
              const description = prop.description || '-';
              const notes = prop.notes || '-';
              return `<tr>
              <td><strong>${prop.name}</strong></td>
              <td>${getCategoryLabel(prop.category)}</td>
              <td style="font-size: 13px;">${description.length > 60 ? description.substring(0, 60) + '...' : description}</td>
              <td style="text-align: center;">${(prop.quantity || 1)}</td>
              <td style="font-size: 13px;">${prop.location || '-'}</td>
              <td style="text-align: center;">${prop.assignedScenes.length}</td>
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

  return (
    <Box
      component="section"
      aria-labelledby="prop-panel-title"
      sx={{
        p: { xs: 2, sm: 3, md: containerPadding },
        maxWidth: isDesktop ? 1700 : '100%',
        mx: 'auto',
      }}
    >
      <ContextualNudgeBanner context="props" accentColor="#a855f7" />

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
              Utstyr & Rekvisitter
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
              <BuildIcon sx={{ fontSize: { xs: 14, sm: 16 }, opacity: 0.7 }} />
              Administrer utstyr og rekvisitter
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
              aria-label="Eksporter rekvisitter til CSV"
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
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Eksporter</Box>}
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
                color: showStats ? '#9333ea' : 'rgba(255,255,255,0.7)',
                borderColor: showStats ? '#9333ea' : 'rgba(255,255,255,0.2)',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
              }}
            >
              <StatsIcon />
            </Button>
          </Tooltip>

          <Tooltip title="Legg til utstyr (Ctrl+N)">
            <Button
              variant="contained"
              onClick={() => handleOpenDialog()}
              aria-label="Legg til ny rekvisitt"
              sx={{
                bgcolor: '#9333ea',
                color: '#000',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                flex: { xs: 1, sm: 'none' },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#6d28d9' },
              }}
            >
              <AddIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Legg til</Box>}
            </Button>
          </Tooltip>

          <Tooltip title="Åpne starterbibliotek for prop-skisser">
            <Button
              variant="outlined"
              onClick={() => setStarterDialogOpen(true)}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                color: '#a5b4fc',
                borderColor: 'rgba(165,180,252,0.45)',
                px: { xs: 1, sm: 2 },
                ...focusVisibleStyles,
                '&:hover': { borderColor: '#818cf8', bgcolor: 'rgba(99,102,241,0.18)' },
              }}
            >
              <LibraryIcon />
              {!isMobile && <Box component="span" sx={{ ml: 1 }}>Startere</Box>}
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
            gap: { xs: 1.5, sm: 2 },
            mb: 2,
            p: { xs: 1.5, sm: 2 },
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 2,
          }}
          role="region"
          aria-label="Statistikk over rekvisitter"
        >
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <PropsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#9333ea' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#9333ea', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.total}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Unike</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <Inventory2Icon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#2196f3' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
              {stats.totalQuantity}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Totalt antall</Typography>
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
          placeholder={isMobile ? 'Søk...' : 'Søk etter navn, kategori, beskrivelse...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1 }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i rekvisitter' },
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
          <Tooltip title="Vis/skjul filtre">
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

          <Tooltip title="Kortvisning">
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

          <Tooltip title="Tabellvisning">
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
          <Box sx={{ display: 'flex', alignItems: 'center', color: '#9333ea', px: { xs: 0.5, sm: 0 } }}>
            <CategoryCustomIcon sx={{ fontSize: 20 }} />
          </Box>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Filtrer på kategori</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label="Filtrer på kategori"
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              }}
            >
              <MenuItem value="all">Alle kategorier</MenuItem>
              {commonCategories.map((cat) => (
                <MenuItem key={cat} value={cat} sx={{ minHeight: TOUCH_TARGET_SIZE }}>
                  {getCategoryLabel(cat)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {(filterCategory !== 'all' || searchQuery) && (
            <Button
              variant="text"
              onClick={() => {
                setFilterCategory('all');
                setSearchQuery('');
              }}
              sx={{ color: '#9333ea', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
            >
              Nullstill
            </Button>
          )}
        </Box>
      </Collapse>

      {/* Results count */}
      {(searchQuery || filterCategory !== 'all') && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(147,51,234,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#9333ea' },
          }}
        >
          Viser {filteredAndSortedProps.length} av {props.length} utstyr
        </Alert>
      )}

      {/* Empty state */}
      {props.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={equipPng}
          title="Ingen utstyr ennå"
          subtitle="Legg til utstyr for å organisere produksjonselementer"
          color="#9333ea"
        />
      ) : filteredAndSortedProps.length === 0 ? (
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
          <Table aria-label="Rekvisitter tabell" sx={{ minWidth: { xs: 600, sm: 'auto' } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedProps.length && filteredAndSortedProps.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedProps.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle rekvisitter"
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#9333ea' } }}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'category'}
                    direction={sortField === 'category' ? sortDirection : 'asc'}
                    onClick={() => handleSort('category')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >
                    Kategori
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'quantity'}
                    direction={sortField === 'quantity' ? sortDirection : 'asc'}
                    onClick={() => handleSort('quantity')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >
                    Antall
                  </TableSortLabel>
                </TableCell>
                <TableCell>Lagringssted</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'scenes'}
                    direction={sortField === 'scenes' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scenes')}
                    sx={{ color: '#fff', '&:hover': { color: '#9333ea' } }}
                  >
                    Scener
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedProps.map((prop) => (
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
                      label={getCategoryLabel(prop.category)}
                      size="small"
                      sx={{ bgcolor: `${getCategoryColor(prop.category)}33`, color: getCategoryColor(prop.category) }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {prop.quantity || 1}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.875rem' }}>
                      {prop.location || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
                      {prop.assignedScenes.length}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title={favorites.has(prop.id) ? 'Fjern favoritt' : 'Favoritt'}>
                        <IconButton
                          onClick={() => toggleFavorite(prop.id)}
                          sx={{ color: favorites.has(prop.id) ? '#ffc107' : 'rgba(255,255,255,0.3)' }}
                        >
                          {favorites.has(prop.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton onClick={() => handleDuplicate(prop)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton onClick={() => handleOpenDialog(prop)} sx={{ color: '#9333ea' }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteWithUndo(prop.id)} sx={{ color: '#ff4444' }}>
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
        /* Grid View - Enhanced Responsive cards */
        <Grid container spacing={{ xs: 2, sm: 2.5, md: 3, lg: 3.5 }} role="list" aria-label="Liste over rekvisitter">
          {filteredAndSortedProps.map((prop) => {
            const categoryColor = getCategoryColor(prop.category);
            const propAssets = getPropAssets(prop.id);
            const stageCounts = getPropStageCounts(prop.id);
            return (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 4 }} key={prop.id} role="listitem">
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
                  {prop.images && prop.images.length > 0 ? (
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
                  ) : prop.modelUrl ? (
                    <Box
                      sx={{
                        width: '100%',
                        height: { xs: 160, sm: 180, md: 200 },
                        background: 'linear-gradient(135deg, rgba(76, 29, 149, 0.45) 0%, rgba(15, 23, 42, 0.9) 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        px: 2,
                      }}
                    >
                      <Model3DIcon sx={{ fontSize: { xs: 40, sm: 48 }, color: '#c4b5fd' }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.95rem' }}>
                        3D-modell tilgjengelig
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setModelPreviewProp(prop)}
                        sx={{
                          color: '#e9d5ff',
                          borderColor: 'rgba(233,213,255,0.45)',
                          minHeight: 34,
                          '&:hover': {
                            borderColor: 'rgba(233,213,255,0.8)',
                            bgcolor: 'rgba(139,92,246,0.2)',
                          },
                        }}
                      >
                        Vis 3D-forhandsvisning
                      </Button>
                    </Box>
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

                  {/* Overlay with category badge and favorite */}
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
                        sx={{
                          p: 0.5,
                          color: 'rgba(255,255,255,0.87)',
                          '&.Mui-checked': { color: '#9333ea' },
                        }}
                      />
                      <Chip
                        label={getCategoryLabel(prop.category)}
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
                    </Box>
                    <IconButton
                      onClick={() => toggleFavorite(prop.id)}
                      aria-label={favorites.has(prop.id) ? 'Fjern favoritt' : 'Legg til favoritt'}
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

                  {prop.modelUrl && (
                    <Chip
                      icon={<Model3DIcon sx={{ fontSize: 14, color: '#fff !important' }} />}
                      label="3D"
                      size="small"
                      onClick={() => setModelPreviewProp(prop)}
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        bgcolor: 'rgba(88, 28, 135, 0.88)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        height: 26,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(107, 33, 168, 0.95)' },
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

                  {propAssets.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ mb: 1.25, flexWrap: 'wrap' }}>
                      {(['sketch', 'design', 'reference', 'final'] as PropAssetStage[]).map((stage) => (
                        <Chip
                          key={stage}
                          size="small"
                          label={`${DESIGN_STAGE_LABELS[stage]} ${stageCounts[stage]}`}
                          sx={{
                            height: 20,
                            fontSize: 10,
                            bgcolor: `${DESIGN_STAGE_COLORS[stage]}20`,
                            color: DESIGN_STAGE_COLORS[stage],
                            fontWeight: 700,
                          }}
                        />
                      ))}
                    </Stack>
                  )}

                  {propAssets.length > 0 && (
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<LibraryIcon sx={{ fontSize: 14 }} />}
                      onClick={() => {
                        setLibraryDialogProp(prop);
                        setLibraryStageFilter('all');
                      }}
                      sx={{
                        alignSelf: 'flex-start',
                        mb: 1.25,
                        mt: -0.5,
                        color: '#a5b4fc',
                        textTransform: 'none',
                        minHeight: 28,
                        px: 0.5,
                      }}
                    >
                      Vis bibliotek
                    </Button>
                  )}

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
                        {prop.quantity} stk
                      </Typography>
                    </Box>
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
                        <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          Lagringsplass
                        </Typography>
                        <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {prop.location}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Assigned scenes badge */}
                  {prop.assignedScenes.length > 0 && (
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
                        <Typography sx={{ fontSize: 14 }}>🎬</Typography>
                      </Box>
                      <Typography sx={{ color: '#c084fc', fontSize: '0.8rem', fontWeight: 600 }}>
                        {prop.assignedScenes.length} scene{prop.assignedScenes.length !== 1 ? 'r' : ''} tildelt
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
                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                            Notater
                          </Typography>
                          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            {prop.notes}
                          </Typography>
                        </Box>
                      )}

                      {/* Additional images */}
                      {prop.images && prop.images.length > 1 && (
                        <Box>
                          <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
                            Flere bilder ({prop.images.length})
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

                      {propAssets.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Sketch / Design Assets
                            </Typography>
                            <Button
                              size="small"
                              onClick={() => {
                                setLibraryDialogProp(prop);
                                setLibraryStageFilter('all');
                              }}
                              sx={{ color: '#a5b4fc', minHeight: 20, px: 0.5, fontSize: '0.72rem' }}
                            >
                              Åpne
                            </Button>
                          </Stack>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {propAssets.slice(0, 6).map((asset) => (
                              <Box key={asset.id} sx={{ width: 76 }}>
                                <Box
                                  component="img"
                                  src={asset.imageUrl}
                                  alt={asset.title}
                                  sx={{
                                    width: 76,
                                    height: 52,
                                    borderRadius: 1,
                                    objectFit: 'cover',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                  }}
                                />
                                <Chip
                                  size="small"
                                  label={`${DESIGN_STAGE_LABELS[asset.stage]} v${asset.version}`}
                                  sx={{
                                    mt: 0.5,
                                    height: 18,
                                    fontSize: 9,
                                    bgcolor: `${DESIGN_STAGE_COLORS[asset.stage]}20`,
                                    color: DESIGN_STAGE_COLORS[asset.stage],
                                  }}
                                />
                              </Box>
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
                      pt: { xs: 2, sm: 2.5 },
                      mt: 'auto',
                      borderTop: '2px solid rgba(147,51,234,0.2)',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="medium"
                      onClick={() => toggleCardExpanded(prop.id)}
                      startIcon={expandedCards.has(prop.id) ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      endIcon={expandedCards.has(prop.id) ? <CollapseIcon /> : <ExpandIcon />}
                      aria-expanded={expandedCards.has(prop.id)}
                      aria-label={expandedCards.has(prop.id) ? 'Skjul detaljer' : 'Vis mer'}
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
                      {expandedCards.has(prop.id) ? 'Skjul detaljer' : 'Vis detaljer'}
                    </Button>
                    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 } }}>
                      <Tooltip title="Dupliser" arrow>
                        <IconButton
                          onClick={() => handleDuplicate(prop)}
                          aria-label={`Dupliser ${prop.name}`}
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
                      <Tooltip title="Rediger" arrow>
                        <IconButton
                          onClick={() => handleOpenDialog(prop)}
                          aria-label={`Rediger ${prop.name}`}
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
                      <Tooltip title="Slett" arrow>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(prop.id)}
                          aria-label={`Slett ${prop.name}`}
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
            </Grid>
          );
          })}
        </Grid>
      )}

      <Dialog
        open={Boolean(modelPreviewProp?.modelUrl)}
        onClose={() => setModelPreviewProp(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1c2128', color: '#fff' }}>
          {modelPreviewProp?.name || '3D-forhandsvisning'}
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0f172a', py: 2 }}>
          {modelPreviewProp?.modelUrl ? (
            <GLB3DPreview
              modelUrl={modelPreviewProp.modelUrl}
              width="100%"
              height={420}
              autoRotate
              backgroundColor="#0f172a"
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#1c2128' }}>
          <Button onClick={() => setModelPreviewProp(null)} sx={{ color: '#c4b5fd' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={starterDialogOpen}
        onClose={() => setStarterDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1c2128', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SketchIcon sx={{ color: '#22d3ee' }} />
          Starterbibliotek for rekvisittskisser
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0f172a', py: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Søk starter"
              value={starterQuery}
              onChange={(event) => setStarterQuery(event.target.value)}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={starterCategory}
                onChange={(event) => setStarterCategory(event.target.value)}
                label="Kategori"
              >
                {starterCategories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category === 'all' ? 'Alle' : category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Grid container spacing={1.5}>
            {filteredStarterTemplates.map((starter) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={starter.id}>
                <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Box
                    component="img"
                    src={starter.previewImageUrl}
                    alt={starter.name}
                    sx={{ width: '100%', height: 124, objectFit: 'cover' }}
                  />
                  <CardContent sx={{ p: 1.25 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                      {starter.name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', mt: 0.35 }}>
                      {starter.description}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.8, flexWrap: 'wrap' }}>
                      {starter.tags.slice(0, 3).map((tag) => (
                        <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: 10 }} />
                      ))}
                    </Stack>
                    <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleCreatePropFromStarter(starter)}
                        sx={{ borderColor: '#22d3ee', color: '#22d3ee', minHeight: 28 }}
                      >
                        Opprett prop
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, images: [...(prev.images || []), starter.previewImageUrl] }));
                          setDialogOpen(true);
                          setStarterDialogOpen(false);
                        }}
                        sx={{ color: '#a5b4fc', minHeight: 28 }}
                      >
                        Bruk i editor
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#1c2128' }}>
          <Button onClick={() => setStarterDialogOpen(false)} sx={{ color: '#c4b5fd' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(libraryDialogProp)}
        onClose={() => setLibraryDialogProp(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1c2128', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          <LibraryIcon sx={{ color: '#a5b4fc' }} />
          Assetbibliotek: {libraryDialogProp?.name}
        </DialogTitle>
        <DialogContent sx={{ bgcolor: '#0f172a', py: 2 }}>
          <Stack direction="row" spacing={0.6} sx={{ mb: 1.25, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label="All"
              onClick={() => setLibraryStageFilter('all')}
              sx={{
                bgcolor: libraryStageFilter === 'all' ? 'rgba(148,163,184,0.26)' : 'rgba(255,255,255,0.08)',
                color: '#fff',
              }}
            />
            {(['sketch', 'design', 'reference', 'final'] as PropAssetStage[]).map((stage) => (
              <Chip
                key={stage}
                size="small"
                label={DESIGN_STAGE_LABELS[stage]}
                onClick={() => setLibraryStageFilter(stage)}
                sx={{
                  bgcolor: libraryStageFilter === stage ? `${DESIGN_STAGE_COLORS[stage]}33` : 'rgba(255,255,255,0.08)',
                  color: libraryStageFilter === stage ? DESIGN_STAGE_COLORS[stage] : 'rgba(255,255,255,0.87)',
                }}
              />
            ))}
          </Stack>

          {libraryDialogAssets.length === 0 ? (
            <Alert severity="info" sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>
              Ingen assets i denne fasen ennå.
            </Alert>
          ) : (
            <Grid container spacing={1.5}>
              {libraryDialogAssets.map((asset) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={asset.id}>
                  <Card sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Box
                      component="img"
                      src={asset.imageUrl}
                      alt={asset.title}
                      sx={{ width: '100%', height: 136, objectFit: 'cover' }}
                    />
                    <CardContent sx={{ p: 1.25 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }} noWrap>
                        {asset.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.7, alignItems: 'center' }}>
                        <Chip
                          size="small"
                          label={`${DESIGN_STAGE_LABELS[asset.stage]} v${asset.version}`}
                          sx={{
                            height: 19,
                            fontSize: 10,
                            bgcolor: `${DESIGN_STAGE_COLORS[asset.stage]}20`,
                            color: DESIGN_STAGE_COLORS[asset.stage],
                          }}
                        />
                        <Chip size="small" label={asset.source} sx={{ height: 19, fontSize: 10 }} />
                      </Stack>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ mt: 1, color: '#22d3ee', borderColor: '#22d3ee' }}
                        onClick={async () => {
                          if (!libraryDialogProp) return;
                          try {
                            await propDesignLibraryService.applyAssetAsPropPreview(projectId, libraryDialogProp.id, asset.id);
                            const loadedProps = await castingService.getProps(projectId);
                            setProps(Array.isArray(loadedProps) ? loadedProps : []);
                            showSuccess(`✅ ${asset.title} satt som forhåndsvisning`);
                          } catch (error) {
                            console.error('Error applying prop asset preview:', error);
                            showError('Kunne ikke sette asset som forhåndsvisning');
                          }
                        }}
                      >
                        Bruk som forhåndsvisning
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#1c2128' }}>
          <Button onClick={() => setLibraryDialogProp(null)} sx={{ color: '#c4b5fd' }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        TransitionComponent={Fade}
        message={`"${deletedProp?.name}" slettet`}
        action={
          <Button
            color="primary"
            size="small"
            onClick={handleUndoDelete}
            startIcon={<CheckIcon fontSize="small" />}
            sx={{ color: '#9333ea' }}
          >
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
          {editingProp ? 'Rediger utstyr' : 'Nytt utstyr'}
          {isMobile && (
            <IconButton onClick={handleCloseDialog} aria-label="Lukk dialog" sx={{ color: 'rgba(255,255,255,0.87)', mr: -1 }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 }, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Typography id={dialogDescId} variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 2 }}>
            Fyll ut informasjon om utstyret. Felter merket med * er påkrevd.
          </Typography>
          <Stack spacing={2.5}>
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
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#9333ea' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#9333ea' },
              }}
            />

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Kategori</InputLabel>
              <Select
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                label="Kategori"
                MenuProps={selectMenuProps}
                sx={{
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                }}
              >
                {commonCategories.map((cat) => (
                  <MenuItem key={cat} value={cat} sx={{ minHeight: TOUCH_TARGET_SIZE }}>
                    {getCategoryLabel(cat)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Beskrivelse"
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
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            {/* Image Upload Section */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <ImageIcon sx={{ color: '#9333ea', fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                <PhotoCameraIcon sx={{ color: '#9333ea', fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                <Typography variant="subtitle2" sx={{ color: '#9333ea', fontWeight: 600 }}>
                  Bilder
                </Typography>
              </Box>
              
              {/* Existing images */}
              {formData.images && formData.images.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                  {formData.images.map((image, index) => (
                    <Box
                      key={index}
                      sx={{
                        position: 'relative',
                        width: { xs: 100, sm: 120 },
                        height: { xs: 100, sm: 120 },
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <Box
                        component="img"
                        src={image}
                        alt={`Bilde ${index + 1}`}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveImage(index)}
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
                >
                  Last opp bilder
                </Button>
              </label>
            </Box>

            <TextField
              label="Antall"
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
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            <TextField
              label="Lagringssted"
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
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />

            <TextField
              label="Notater"
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
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
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
            sx={{ color: 'rgba(255,255,255,0.87)', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={<SaveIcon />}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#9333ea',
              color: '#000',
              fontWeight: 600,
              minHeight: TOUCH_TARGET_SIZE,
              ...focusVisibleStyles,
              '&:hover': { bgcolor: '#6d28d9' },
            }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
