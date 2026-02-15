import { useState, useId, useMemo, useEffect, memo } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
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
  Movie as MovieIcon,
  ViewInAr as ViewInArIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Preview as PreviewIcon,
  Lightbulb as LightbulbIcon,
  WbSunny as SunnyIcon,
  Tungsten as TungstenIcon,
  FlashOn as FlashIcon,
  Upload as UploadIcon,
  FileCopy as CopyToProjectIcon,
  Inventory as InventoryIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { CandidatesIcon as RecentActorsIcon, RolesIcon, StatsIcon } from './icons/CastingIcons';
import { ConsentStatusBadge } from './ConsentStatusBadge';
import { candidatePoolService } from '../services/candidatePoolService';
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
import { Candidate, Role } from '../models/casting';
import { castingService } from '../services/castingService';
import { castingAuthService } from '../services/castingAuthService';
import { castingToSceneService } from '../services/castingToSceneService';
import { useToast } from './ToastStack';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px touch targets
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #10b981',
    outlineOffset: 2,
  },
};

type SortField = 'name' | 'status' | 'roles' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type StatusFilter = 'all' | 'pending' | 'requested' | 'shortlist' | 'selected' | 'confirmed' | 'rejected';

interface CandidateManagementPanelProps {
  projectId: string;
  candidates: Candidate[];
  roles: Role[];
  onCandidatesChange: () => void;
  onEditCandidate: (candidate: Candidate) => void;
  onCreateCandidate: () => void;
  profession?: 'photographer' | 'videographer' | null;
}

function CandidateManagementPanelInner({
  projectId,
  candidates,
  roles,
  onCandidatesChange,
  onEditCandidate,
  onCreateCandidate,
  profession,
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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showStats, setShowStats] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Candidate | null>(null);
  const [addingToScene, setAddingToScene] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [candidatesToPreview, setCandidatesToPreview] = useState<Candidate[]>([]);
  const [poolMode, setPoolMode] = useState<'project' | 'pool'>('project');
  const [poolCandidates, setPoolCandidates] = useState<import('../services/candidatePoolService').PoolCandidate[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);

  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  const FAVORITES_NAMESPACE = 'virtualStudio_candidateFavorites';

  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
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
      const values = [...favorites];
      await settingsService.setSetting(FAVORITES_NAMESPACE, values, { projectId });
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
        await favoritesApi.set(projectId, 'candidate', values);
      } catch (error) {
        console.warn('Database save failed:', error);
      }
    };
    if (!favoritesLoaded) return;
    saveFavorites();
  }, [favorites, projectId, favoritesLoaded]);

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
      case 'shortlist': return 'Shortlist';
      case 'rejected': return 'Avvist';
      case 'requested': return 'Forespurt';
      default: return 'Venter';
    }
  };

  // Filter and sort
  const filteredAndSortedCandidates = useMemo(() => {
    let result = [...candidates];
    
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.contactInfo.email?.toLowerCase().includes(q) ||
        c.contactInfo.phone?.toLowerCase().includes(q) ||
        c.auditionNotes.toLowerCase().includes(q)
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
      
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'roles':
          comparison = (a.assignedRoles?.length || 0) - (b.assignedRoles?.length || 0);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [candidates, searchQuery, statusFilter, sortField, sortDirection, favorites]);

  // Statistics
  const statistics = useMemo(() => ({
    total: candidates.length,
    confirmed: candidates.filter(c => c.status === 'confirmed').length,
    selected: candidates.filter(c => c.status === 'selected').length,
    shortlist: candidates.filter(c => c.status === 'shortlist').length,
    pending: candidates.filter(c => c.status === 'pending' || c.status === 'requested').length,
    favorites: favorites.size,
  }), [candidates, favorites]);

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

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedCandidates.map(c => c.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
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
      ? candidates.filter(c => selectedIds.has(c.id))
      : candidates.filter(c => c.status === 'confirmed' || c.status === 'selected');
    
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
        roles,
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

  const handleImportFromPool = async (poolCandidate: import('../services/candidatePoolService').PoolCandidate) => {
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

      const htmlContent = generateCandidatesHTML(project, filteredAndSortedCandidates, roles);

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
                  const rolesList = c.assignedRoles?.map(rid => roles.find(r => r.id === rid)?.name || '').filter(Boolean).join(', ') || '-';
                  return `<tr>
              <td><strong>${c.name}</strong></td>
              <td style="font-size: 13px;">${c.contactInfo?.email || '-'}</td>
              <td style="font-size: 13px;">${c.contactInfo?.phone || '-'}</td>
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

  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Ukjent rolle';

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
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
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.15) 100%)',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
              },
            }}
          >
            <RecentActorsIcon
              sx={{
                color: '#6ee7b7',
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
                background: 'linear-gradient(135deg, #fff 0%, #6ee7b7 100%)',
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
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
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
                borderColor: 'rgba(255,255,255,0.2)',
                color: showStats ? '#000' : '#fff',
                bgcolor: showStats ? '#10b981' : 'transparent',
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
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
                borderColor: 'rgba(139, 92, 246, 0.5)',
                color: '#a78bfa',
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': {
                  borderColor: '#8b5cf6',
                  bgcolor: 'rgba(139, 92, 246, 0.1)',
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
                bgcolor: '#10b981',
                color: '#fff',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                '&:hover': { bgcolor: '#059669' },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? '' : 'Ny kandidat'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Project/Templates Toggle */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant={poolMode === 'project' ? 'contained' : 'outlined'}
          onClick={() => setPoolMode('project')}
          startIcon={<RecentActorsIcon />}
          sx={{
            bgcolor: poolMode === 'project' ? '#10b981' : 'transparent',
            color: poolMode === 'project' ? '#fff' : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'project' ? '#10b981' : 'rgba(255,255,255,0.2)',
            minHeight: TOUCH_TARGET_SIZE,
            '&:hover': { bgcolor: poolMode === 'project' ? '#059669' : 'rgba(255,255,255,0.05)' },
            ...focusVisibleStyles,
          }}
        >
          Prosjekt
          <Chip
            label={candidates.length}
            size="small"
            sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: 20, fontSize: '0.7rem' }}
          />
        </Button>
        <Button
          variant={poolMode === 'pool' ? 'contained' : 'outlined'}
          onClick={() => { setPoolMode('pool'); loadPoolCandidates(); }}
          startIcon={<InventoryIcon />}
          sx={{
            bgcolor: poolMode === 'pool' ? '#9c27b0' : 'transparent',
            color: poolMode === 'pool' ? '#fff' : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'pool' ? '#9c27b0' : 'rgba(255,255,255,0.2)',
            minHeight: TOUCH_TARGET_SIZE,
            '&:hover': { bgcolor: poolMode === 'pool' ? '#7b1fa2' : 'rgba(255,255,255,0.05)' },
            ...focusVisibleStyles,
          }}
        >
          Maler
          <Chip
            label={poolCandidates.length}
            size="small"
            sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: 20, fontSize: '0.7rem' }}
          />
        </Button>
      </Box>

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
            bgcolor: 'rgba(16, 185, 129, 0.05)',
            borderRadius: 2,
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <RecentActorsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#10b981' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>{statistics.total}</Typography>
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
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Shortlist</Typography>
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
          placeholder={isMobile ? 'Søk...' : 'Søk på navn, e-post, telefon, notater...'}
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
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#10b981' },
            },
          }}
        />

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140, md: 135, lg: 150, xl: 180 } }}>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filtrer etter status"
            sx={{
              color: '#fff',
              minHeight: TOUCH_TARGET_SIZE,
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#10b981' },
            }}
          >
            <MenuItem value="all">Alle statuser</MenuItem>
            <MenuItem value="pending">Venter</MenuItem>
            <MenuItem value="requested">Forespurt</MenuItem>
            <MenuItem value="shortlist">Shortlist</MenuItem>
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
              aria-pressed={viewMode === 'grid'}
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: TOUCH_TARGET_SIZE,
                bgcolor: viewMode === 'grid' ? 'rgba(16,185,129,0.2)' : 'transparent',
                color: viewMode === 'grid' ? '#10b981' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? '#10b981' : 'rgba(255,255,255,0.2)',
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
                bgcolor: viewMode === 'table' ? 'rgba(16,185,129,0.2)' : 'transparent',
                color: viewMode === 'table' ? '#10b981' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? '#10b981' : 'rgba(255,255,255,0.2)',
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
            bgcolor: 'rgba(16,185,129,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#10b981' },
          }}
        >
          Viser {filteredAndSortedCandidates.length} av {candidates.length} kandidater
        </Alert>
      )}

      {/* Empty state */}
      {candidates.length === 0 ? (
        <Box
          role="status"
          sx={{
            textAlign: 'center',
            py: { xs: 4, sm: 6, md: 5, lg: 7, xl: 8 },
            px: { xs: 2, sm: 4, md: 3.5, lg: 4, xl: 5 },
            bgcolor: 'rgba(16, 185, 129, 0.03)',
            borderRadius: 3,
            border: '2px dashed rgba(16, 185, 129, 0.2)',
          }}
        >
          <Box
            sx={{
              width: { xs: 60, sm: 70, md: 65, lg: 80, xl: 104 },
              height: { xs: 60, sm: 70, md: 65, lg: 80, xl: 104 },
              borderRadius: '50%',
              bgcolor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            }}
          >
            <PersonIcon sx={{ fontSize: { xs: 30, sm: 36, md: 33, lg: 40, xl: 52 }, color: '#10b981' }} />
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: 1, fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' } }}>
            Legg til kandidater
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 }, maxWidth: { xs: 300, sm: 400, md: 350, lg: 450, xl: 500 }, mx: 'auto', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
            {roles.length > 0
              ? `Du har ${roles.length} rolle${roles.length > 1 ? 'r' : ''} som venter på kandidater.`
              : 'Start med å opprette roller, deretter legg til kandidater.'}
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            onClick={onCreateCandidate}
            sx={{
              bgcolor: '#10b981',
              color: '#fff',
              fontWeight: 600,
              px: { xs: 3, sm: 4, md: 3.5, lg: 4, xl: 5 },
              py: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.5, xl: 1.75 },
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              minHeight: TOUCH_TARGET_SIZE,
              '&:hover': { bgcolor: '#059669', transform: 'translateY(-2px)' },
              transition: 'all 0.2s',
              ...focusVisibleStyles,
            }}
          >
            Legg til kandidat
          </Button>
        </Box>
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
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#10b981' } }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#fff', py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Fav</TableCell>
                <TableCell sx={{ color: '#fff', py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Bilde</TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#10b981' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#10b981' } }}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Kontakt</TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'roles'}
                    direction={sortField === 'roles' ? sortDirection : 'asc'}
                    onClick={() => handleSort('roles')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#10b981' } }}
                  >
                    Roller
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedCandidates.map((candidate) => (
                <TableRow
                  key={candidate.id}
                  sx={{
                    bgcolor: selectedIds.has(candidate.id) ? 'rgba(16,185,129,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onChange={() => handleToggleSelect(candidate.id)}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#10b981' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <IconButton onClick={() => toggleFavorite(candidate.id)} sx={{ color: favorites.has(candidate.id) ? '#ffc107' : 'rgba(255,255,255,0.3)' }}>
                      {favorites.has(candidate.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Avatar
                      src={candidate.photos?.[0]}
                      alt={candidate.name}
                      sx={{ width: { xs: 36, sm: 40, md: 38, lg: 44, xl: 52 }, height: { xs: 36, sm: 40, md: 38, lg: 44, xl: 52 }, bgcolor: `${getStatusColor(candidate.status)}20` }}
                    >
                      <PersonIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 }, color: getStatusColor(candidate.status) }} />
                    </Avatar>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>{candidate.name}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip
                      label={getStatusLabel(candidate.status)}
                      size="small"
                      sx={{ bgcolor: `${getStatusColor(candidate.status)}20`, color: getStatusColor(candidate.status), fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Stack spacing={0.5}>
                      {candidate.contactInfo.email && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                          <EmailIcon sx={{ fontSize: { xs: 12, sm: 14, md: 13, lg: 15, xl: 18 } }} /> {candidate.contactInfo.email}
                        </Typography>
                      )}
                      {candidate.contactInfo.phone && (
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                          <PhoneIcon sx={{ fontSize: { xs: 12, sm: 14, md: 13, lg: 15, xl: 18 } }} /> {candidate.contactInfo.phone}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {candidate.assignedRoles?.slice(0, 2).map(roleId => (
                        <Chip key={roleId} label={getRoleName(roleId)} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' }, height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                      ))}
                      {(candidate.assignedRoles?.length || 0) > 2 && (
                        <Chip label={`+${(candidate.assignedRoles?.length || 0) - 2}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.68rem', lg: '0.75rem', xl: '0.85rem' }, height: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title="Lagre til pool">
                        <IconButton onClick={() => handleSaveToPool(candidate)} sx={{ color: '#8b5cf6', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <UploadIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton onClick={() => handleDuplicate(candidate)} sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <DuplicateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton onClick={() => onEditCandidate(candidate)} sx={{ color: '#10b981', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <EditIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteWithUndo(candidate)} sx={{ color: '#ff4444', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
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
      ) : (
        /* Grid View - Enhanced cards matching ProductionDayView */
        <Grid container spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 }}>
          {filteredAndSortedCandidates.map((candidate) => {
            const statusColor = getStatusColor(candidate.status);
            const statusLabel = getStatusLabel(candidate.status);

            return (
              <Grid key={candidate.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  component="article"
                  sx={{
                    bgcolor: selectedIds.has(candidate.id) ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                    border: selectedIds.has(candidate.id) ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      borderColor: '#10b981',
                      boxShadow: '0 8px 24px rgba(16,185,129,0.2)',
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
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '100%',
                          height: { xs: 100, sm: 120, md: 110, lg: 140, xl: 180 },
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.15) 100%)',
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
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: '3px solid rgba(255,255,255,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
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
                          sx={{ p: 0.5, color: 'rgba(255,255,255,0.6)', '&.Mui-checked': { color: '#10b981' } }}
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

                    {/* Contact Info Cards - Enhanced */}
                    <Stack spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                      {candidate.contactInfo.email && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.25)',
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(16,185,129,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <EmailIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#6ee7b7' }} />
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
                              {candidate.contactInfo.email}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      {candidate.contactInfo.phone && (
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
                              {candidate.contactInfo.phone}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Stack>

                    {/* Expandable content */}
                    <Collapse in={expandedCards.has(candidate.id)}>
                      <Box sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                        {candidate.auditionNotes && (
                          <Box
                            sx={{
                              mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: 2,
                              bgcolor: 'rgba(16,185,129,0.08)',
                              border: '1px solid rgba(16,185,129,0.2)',
                            }}
                          >
                            <Typography
                              variant="subtitle2"
                              sx={{
                                color: '#10b981',
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
                              {candidate.auditionNotes}
                            </Typography>
                          </Box>
                        )}
                        {candidate.assignedRoles && candidate.assignedRoles.length > 0 && (
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
                              {(candidate.assignedRoles || []).map(roleId => (
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
                        borderTop: '2px solid rgba(16,185,129,0.2)',
                      }}
                    >
                      <Button
                        variant="contained"
                        size="medium"
                        onClick={() => toggleCardExpanded(candidate.id)}
                        endIcon={expandedCards.has(candidate.id) ? <CollapseIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <ExpandIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        sx={{
                          bgcolor: expandedCards.has(candidate.id)
                            ? 'rgba(16,185,129,0.25)'
                            : 'rgba(16,185,129,0.15)',
                          color: expandedCards.has(candidate.id) ? '#6ee7b7' : '#fff',
                          fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                          fontWeight: 600,
                          minHeight: TOUCH_TARGET_SIZE,
                          px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                          py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                          border: expandedCards.has(candidate.id)
                            ? '2px solid rgba(16,185,129,0.5)'
                            : '2px solid rgba(16,185,129,0.3)',
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: expandedCards.has(candidate.id)
                            ? '0 4px 12px rgba(16,185,129,0.3)'
                            : '0 2px 8px rgba(16,185,129,0.2)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(16,185,129,0.35)',
                            borderColor: 'rgba(16,185,129,0.6)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 16px rgba(16,185,129,0.4)',
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
                              '&:hover': { bgcolor: 'rgba(139,92,246,0.1)' },
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
                              color: '#10b981',
                              '&:hover': { bgcolor: 'rgba(16,185,129,0.1)' },
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
              </Grid>
            );
          })}
        </Grid>
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
                            }}
                          >
                            <PersonIcon sx={{ color: '#ce93d8' }} />
                          </Avatar>
                          <Box>
                            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                              {poolCandidate.name}
                            </Typography>
                            {poolCandidate.contactInfo?.email && (
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <EmailIcon sx={{ fontSize: 12 }} />
                                {poolCandidate.contactInfo.email}
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

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message="Kandidat slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#10b981' }}>
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
                        bgcolor: 'rgba(16,185,129,0.15)',
                        color: '#10b981',
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
              const assignedRoles = roles.filter(r => (candidate.assignedRoles || []).includes(r.id));
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
                        color: '#10b981',
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
    </Box>
  );
}

export const CandidateManagementPanel = memo(CandidateManagementPanelInner);
