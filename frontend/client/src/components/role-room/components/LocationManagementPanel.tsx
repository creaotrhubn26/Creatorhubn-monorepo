import React, { useState, useMemo, useEffect, useId } from 'react';
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
  InputAdornment,
  Chip,
  Stack,
  Grid,
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
  Cancel as CancelIcon,
  Save as SaveIcon,
  Explore as ExploreIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import { 
  LocationsIcon as LocationIcon, 
  StatsIcon, 
  AnalyticsIcon,
  PersonNameIcon,
  AddressIcon,
  CapacityIcon,
  NotesIcon,
  PhoneIcon as CustomPhoneIcon,
} from './icons/CastingIcons';
import { Location } from '../models/casting';
import { castingService } from '../services/castingService';
import { externalDataService } from '@/services/ExternalDataService';
import { LocationAnalysisDialog } from './LocationAnalysisDialog';
import { useToast } from './ToastStack';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import locationPng from './icons/Keep/roleroom_location.png';

// WCAG 2.2 - 2.5.5 Target Size (minimum 44x44px)
const TOUCH_TARGET_SIZE = 44;

// Focus visible styles for WCAG 2.4.7
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #00d4ff',
    outlineOffset: 2,
  },
};

type SortField = 'name' | 'type' | 'capacity' | 'scenes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

interface LocationManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
}

export function LocationManagementPanel({ projectId, onUpdate }: LocationManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  // Unique IDs for WCAG
  const baseId = useId();
  const dialogTitleId = `${baseId}-dialog-title`;
  const dialogDescId = `${baseId}-dialog-desc`;

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();

  // Core state
  const [locations, setLocations] = useState<Location[]>([]);
  
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [selectedLocationForAnalysis, setSelectedLocationForAnalysis] = useState<Location | null>(null);
  const [validatingAddress, setValidatingAddress] = useState(false);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<Location['type'] | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);

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
        const { favoritesApi } = await import('@/services/castingApiService');
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
        const { favoritesApi } = await import('@/services/castingApiService');
        await favoritesApi.set(projectId, 'location', values);
      } catch (error) {
        console.warn('Database save failed:', error);
      }
    };
    if (!favoritesLoaded) return;
    saveFavorites();
  }, [favorites, projectId, favoritesLoaded]);

  const getTypeLabel = (type: Location['type']): string => {
    const labels: Record<Location['type'], string> = {
      studio: 'Studio',
      outdoor: 'Utendørs',
      indoor: 'Innendørs',
      virtual: 'Virtuell',
      other: 'Annet',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: Location['type']): string => {
    const colors: Record<Location['type'], string> = {
      studio: '#9c27b0',
      outdoor: '#4caf50',
      indoor: '#2196f3',
      virtual: '#9333ea',
      other: '#607d8b',
    };
    return colors[type] || '#607d8b';
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

  // Filter and sort locations
  const filteredAndSortedLocations = useMemo(() => {
    let result = [...locations];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (loc) =>
          loc.name.toLowerCase().includes(query) ||
          loc.address.toLowerCase().includes(query) ||
          getTypeLabel(loc.type).toLowerCase().includes(query) ||
          (loc.notes && loc.notes.toLowerCase().includes(query))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((loc) => loc.type === filterType);
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
          comparison = (a.capacity || 0) - (b.capacity || 0);
          break;
        case 'scenes':
          comparison = a.assignedScenes.length - b.assignedScenes.length;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [locations, searchQuery, filterType, sortField, sortDirection, favorites]);

  // Statistics
  const stats = useMemo(() => {
    const typeCount = locations.reduce((acc, loc) => {
      acc[loc.type] = (acc[loc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalCapacity = locations.reduce((sum, loc) => sum + (loc.capacity || 0), 0);
    const withCoordinates = locations.filter((loc) => loc.coordinates).length;

    return {
      total: locations.length,
      typeCount,
      totalCapacity,
      withCoordinates,
      favorites: favorites.size,
    };
  }, [locations, favorites]);

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

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLocation(null);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showError('⚠️ Navn er påkrevd');
      return;
    }

    try {
      const location: Location = editingLocation
        ? { ...editingLocation, ...formData, updatedAt: new Date().toISOString() }
        : {
            id: `location-${Date.now()}`,
            name: formData.name || '',
            address: formData.address || '',
            type: formData.type || 'indoor',
            capacity: formData.capacity,
            facilities: formData.facilities || [],
            availability: formData.availability || {},
            assignedScenes: formData.assignedScenes || [],
            contactInfo: formData.contactInfo,
            notes: formData.notes,
            coordinates: formData.coordinates,
            propertyId: formData.propertyId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      await castingService.saveLocation(projectId, location);
      const locs = await castingService.getLocations(projectId);
      setLocations(Array.isArray(locs) ? locs : []);

      // Show success notification
      if (editingLocation) {
        showSuccess(`✅ ${formData.name} oppdatert`, 3000);
      } else {
        showSuccess(`📍 ${formData.name} lagt til`, 3000);
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
        showInfo(`🗑️ ${location.name} slettet - klikk "Angre" for å gjenopprette`, 6000);
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
        showSuccess(`↩️ ${deletedLocation.name} gjenopprettet`, 3000);
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

    const locationIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #4caf50; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #4caf50; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #4caf50; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #4caf50; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #4caf50; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
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

  return (
    <Box
      component="section"
      aria-labelledby="location-panel-title"
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
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
              width: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              height: { xs: 48, sm: 56, md: 52, lg: 60, xl: 68 },
              borderRadius: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.25) 0%, rgba(76, 175, 80, 0.15) 100%)',
              border: '2px solid rgba(76, 175, 80, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(76, 175, 80, 0.2)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(76, 175, 80, 0.3)',
              },
            }}
          >
            <PlaceIcon
              sx={{
                color: '#81c784',
                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
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
                background: 'linear-gradient(135deg, #fff 0%, #81c784 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Produksjonssteder
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
              <ExploreIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, opacity: 0.7 }} />
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
                color: showStats ? '#4caf50' : 'rgba(255,255,255,0.7)',
                borderColor: showStats ? '#4caf50' : 'rgba(255,255,255,0.2)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              <StatsIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          <Tooltip title="Legg til lokasjon (Ctrl+N)">
            <Button
              variant="contained"
              onClick={() => handleOpenDialog()}
              aria-label="Legg til ny lokasjon"
              startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              sx={{
                bgcolor: '#4caf50',
                color: '#fff',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                flex: { xs: 1, sm: 'none' },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#43a047' },
              }}
            >
              {isMobile ? '' : 'Legg til'}
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
          }}
          role="region"
          aria-label="Statistikk over lokasjoner"
        >
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <LocationIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#4caf50' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.total}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Totalt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <GroupIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#2196f3' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
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
              '&.Mui-focused fieldset': { borderColor: '#4caf50' },
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
                bgcolor: showFilters ? 'rgba(76,175,80,0.2)' : 'transparent',
                color: showFilters ? '#4caf50' : 'rgba(255,255,255,0.7)',
                borderColor: showFilters ? '#4caf50' : 'rgba(255,255,255,0.2)',
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
                bgcolor: viewMode === 'grid' ? 'rgba(76,175,80,0.2)' : 'transparent',
                color: viewMode === 'grid' ? '#4caf50' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? '#4caf50' : 'rgba(255,255,255,0.2)',
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
                bgcolor: viewMode === 'table' ? 'rgba(76,175,80,0.2)' : 'transparent',
                color: viewMode === 'table' ? '#4caf50' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? '#4caf50' : 'rgba(255,255,255,0.2)',
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

          {(filterType !== 'all' || searchQuery) && (
            <Button
              variant="text"
              onClick={() => {
                setFilterType('all');
                setSearchQuery('');
              }}
              sx={{ 
                color: '#9333ea', 
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles 
              }}
            >
              Nullstill
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
            bgcolor: 'rgba(76,175,80,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#4caf50' },
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
          subtitle="Legg til lokasjoner for å organisere produksjonssteder"
          color="#4caf50"
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
          <Table aria-label="Lokasjoner tabell" sx={{ minWidth: { xs: 600, sm: 700, md: 750, lg: 850, xl: 1100 } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedLocations.length && filteredAndSortedLocations.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedLocations.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle lokasjoner"
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#4caf50' } }}
                  />
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#4caf50' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'type'}
                    direction={sortField === 'type' ? sortDirection : 'asc'}
                    onClick={() => handleSort('type')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#4caf50' } }}
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
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#4caf50' } }}
                  >
                    Kapasitet
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'scenes'}
                    direction={sortField === 'scenes' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scenes')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#4caf50' } }}
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
                    bgcolor: selectedIds.has(location.id) ? 'rgba(76,175,80,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(location.id)}
                      onChange={() => handleToggleSelect(location.id)}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#4caf50' } }}
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
                            onClick={() => handleCopyAddress(location.address, location.id)}
                            sx={{ color: copiedId === location.id ? '#4caf50' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
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
                      {location.assignedScenes.length}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      <Tooltip title={favorites.has(location.id) ? 'Fjern favoritt' : 'Favoritt'}>
                        <IconButton
                          onClick={() => toggleFavorite(location.id)}
                          sx={{ color: favorites.has(location.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                        >
                          {favorites.has(location.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton onClick={() => handleDuplicate(location)} sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <DuplicateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton onClick={() => handleOpenDialog(location)} sx={{ color: '#4caf50', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <EditIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteWithUndo(location.id)} sx={{ color: '#ff4444', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
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
        /* Grid View - Enhanced Responsive cards */
        <Grid container spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 }} role="list" aria-label="Liste over lokasjoner">
          {filteredAndSortedLocations.map((location) => {
            const typeColor = getTypeColor(location.type);
            return (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={location.id} role="listitem">
              <Card
                component="article"
                aria-labelledby={`location-name-${location.id}`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: selectedIds.has(location.id) ? 'rgba(76,175,80,0.08)' : 'rgba(255,255,255,0.03)',
                  border: selectedIds.has(location.id) ? '2px solid #4caf50' : '2px solid rgba(76,175,80,0.2)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  ...focusVisibleStyles,
                  '&:hover': {
                    borderColor: 'rgba(76,175,80,0.6)',
                    boxShadow: '0 8px 24px rgba(76,175,80,0.25)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {/* Gradient Header */}
                <Box
                  sx={{
                    background: `linear-gradient(135deg, ${typeColor}25 0%, rgba(76,175,80,0.15) 100%)`,
                    borderBottom: `1px solid ${typeColor}40`,
                    p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, flex: 1 }}>
                      <Checkbox
                        checked={selectedIds.has(location.id)}
                        onChange={() => handleToggleSelect(location.id)}
                        sx={{
                          p: 0.5,
                          color: 'rgba(255,255,255,0.87)',
                          '&.Mui-checked': { color: '#4caf50' },
                        }}
                      />
                      <Box
                        sx={{
                          width: { xs: 44, sm: 52, md: 48, lg: 60, xl: 68 },
                          height: { xs: 44, sm: 52, md: 48, lg: 60, xl: 68 },
                          borderRadius: 2,
                          bgcolor: `${typeColor}30`,
                          border: `2px solid ${typeColor}50`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 4px 12px ${typeColor}30`,
                        }}
                      >
                        <LocationIcon sx={{ color: typeColor, fontSize: { xs: 24, sm: 28, md: 26, lg: 32, xl: 36 } }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="h6"
                          component="h3"
                          id={`location-name-${location.id}`}
                          sx={{
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: { xs: '1rem', sm: '1.15rem', md: '1.075rem', lg: '1.2rem', xl: '1.375rem' },
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {location.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 }, mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, flexWrap: 'wrap' }}>
                          <Chip
                            label={getTypeLabel(location.type)}
                            size="small"
                            sx={{
                              bgcolor: `${typeColor}40`,
                              color: typeColor,
                              fontWeight: 700,
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                              border: `1px solid ${typeColor}60`,
                            }}
                          />
                          {location.capacity && (
                            <Chip
                              icon={<GroupIcon sx={{ fontSize: { xs: 12, sm: 14, md: 13, lg: 15, xl: 18 }, color: 'rgba(255,255,255,0.7) !important' }} />}
                              label={location.capacity}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                    <IconButton
                      onClick={() => toggleFavorite(location.id)}
                      aria-label={favorites.has(location.id) ? 'Fjern favoritt' : 'Legg til favoritt'}
                      sx={{
                        color: favorites.has(location.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                        minWidth: TOUCH_TARGET_SIZE,
                        minHeight: TOUCH_TARGET_SIZE,
                        ...focusVisibleStyles,
                      }}
                    >
                      {favorites.has(location.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />}
                    </IconButton>
                  </Box>
                </Box>

                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                        bgcolor: 'rgba(76,175,80,0.1)',
                        border: '1px solid rgba(76,175,80,0.25)',
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 40, sm: 44, md: 42, lg: 50, xl: 58 },
                          height: { xs: 40, sm: 44, md: 42, lg: 50, xl: 58 },
                          borderRadius: 1.5,
                          bgcolor: 'rgba(76,175,80,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LocationIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 }, color: '#81c784' }} />
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
                          onClick={() => handleCopyAddress(location.address, location.id)}
                          sx={{ color: copiedId === location.id ? '#4caf50' : 'rgba(255,255,255,0.4)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
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
                        <Typography sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 18, xl: 20 } }}>📍</Typography>
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
                              bgcolor: 'rgba(76,175,80,0.2)',
                              color: '#81c784',
                              fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                              height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                              fontWeight: 600,
                              border: '1px solid rgba(76,175,80,0.4)',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Assigned scenes */}
                  {location.assignedScenes.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                        p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                        borderRadius: 1.5,
                        bgcolor: 'rgba(76,175,80,0.1)',
                        border: '1px solid rgba(76,175,80,0.3)',
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 28, sm: 32, md: 30, lg: 36, xl: 42 },
                          height: { xs: 28, sm: 32, md: 30, lg: 36, xl: 42 },
                          borderRadius: 1,
                          bgcolor: 'rgba(76,175,80,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 18, xl: 20 } }}>🎬</Typography>
                      </Box>
                      <Typography sx={{ color: '#81c784', fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, fontWeight: 600 }}>
                        {location.assignedScenes.length} scene{location.assignedScenes.length !== 1 ? 'r' : ''} tildelt
                      </Typography>
                    </Box>
                  )}

                  {/* Expandable section */}
                  <Collapse in={expandedCards.has(location.id)}>
                    <Box sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, pt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, borderTop: '2px solid rgba(76,175,80,0.2)' }}>
                      {location.notes && (
                        <Box
                          sx={{
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
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
                      alignItems: 'center',
                      pt: { xs: 2, sm: 2.5 },
                      mt: 'auto',
                      borderTop: '2px solid rgba(76,175,80,0.2)',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="medium"
                      onClick={() => toggleCardExpanded(location.id)}
                      endIcon={expandedCards.has(location.id) ? <CollapseIcon /> : <ExpandIcon />}
                      aria-expanded={expandedCards.has(location.id)}
                      aria-label={expandedCards.has(location.id) ? 'Skjul info' : 'Vis info'}
                      sx={{
                        bgcolor: expandedCards.has(location.id) 
                          ? 'rgba(76,175,80,0.2)' 
                          : 'rgba(76,175,80,0.12)',
                        color: expandedCards.has(location.id) ? '#81c784' : '#fff',
                        fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '0.90625rem', lg: '0.96875rem', xl: '1.0625rem' },
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        minHeight: TOUCH_TARGET_SIZE,
                        px: { xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
                        py: { xs: 0.875, sm: 1, md: 0.9375, lg: 1, xl: 1.25 },
                        border: expandedCards.has(location.id) 
                          ? '1.5px solid rgba(76,175,80,0.4)' 
                          : '1.5px solid rgba(76,175,80,0.25)',
                        borderRadius: 2.5,
                        textTransform: 'none',
                        boxShadow: expandedCards.has(location.id) 
                          ? '0 2px 8px rgba(76,175,80,0.25)' 
                          : '0 1px 4px rgba(76,175,80,0.15)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: expandedCards.has(location.id)
                            ? 'rgba(76,175,80,0.3)'
                            : 'rgba(76,175,80,0.2)',
                          borderColor: 'rgba(76,175,80,0.5)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(76,175,80,0.35)',
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
                      {expandedCards.has(location.id) ? 'Skjul info' : 'Info'}
                    </Button>
                    <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 }, ml: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                      <Tooltip title="Analyser lokasjon" arrow>
                        <IconButton
                          onClick={() => handleOpenAnalysisDialog(location)}
                          aria-label={`Analyser ${location.name}`}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: '#00d4ff',
                            bgcolor: 'rgba(0,212,255,0.15)',
                            border: '1px solid rgba(0,212,255,0.3)',
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            '&:hover': { 
                              bgcolor: 'rgba(0,212,255,0.25)',
                              borderColor: 'rgba(0,212,255,0.5)',
                              transform: 'scale(1.05)',
                            },
                            '&:active': {
                              transform: 'scale(0.95)',
                            },
                            ...focusVisibleStyles,
                          }}
                        >
                          <AnalyticsIcon sx={{ fontSize: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser" arrow>
                        <IconButton
                          onClick={() => handleDuplicate(location)}
                          aria-label={`Dupliser ${location.name}`}
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
                      <Tooltip title="Rediger" arrow>
                        <IconButton
                          onClick={() => handleOpenDialog(location)}
                          aria-label={`Rediger ${location.name}`}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: '#81c784',
                            '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett" arrow>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(location.id)}
                          aria-label={`Slett ${location.name}`}
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

      {/* Undo Delete Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message={`"\${deletedLocation?.name}" slettet`}
        action={
          <Button color="primary" size="small" onClick={handleUndoDelete} sx={{ color: '#4caf50' }}>
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
              maxWidth: { xs: '95vw', sm: '85vw', md: '80vw', lg: '75vw', xl: '70vw' },
              m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 4 },
              borderRadius: { xs: 0, sm: 2 },
              willChange: 'transform, opacity',
              transformOrigin: 'center center',
              zIndex: 100000,
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
            py: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
            gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
          }}
        >
          <Typography sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem', md: '1.1875rem', lg: '1.375rem', xl: '1.75rem' }, fontWeight: 600 }}>
            {editingLocation ? 'Rediger lokasjon' : 'Ny lokasjon'}
          </Typography>
          {isMobile && (
            <IconButton onClick={handleCloseDialog} aria-label="Lukk dialog" sx={{ color: 'rgba(255,255,255,0.87)', mr: -1, minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
              <CloseIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: { xs: 2, sm: 3, md: 2.5, lg: 3, xl: 3.5 }, px: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 }, pb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Typography id={dialogDescId} variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
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
                  '&.Mui-focused fieldset': { borderColor: '#4caf50' },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#4caf50' },
              }}
            />

            <Box>
              <TextField
                label="Adresse"
                fullWidth
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AddressIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                    </InputAdornment>
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
              <Button
                variant="outlined"
                onClick={handleValidateAddress}
                disabled={validatingAddress || !formData.address?.trim()}
                size="small"
                sx={{
                  color: '#4caf50',
                  borderColor: 'rgba(76,175,80,0.5)',
                  minHeight: TOUCH_TARGET_SIZE,
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  '&:hover': { borderColor: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)' },
                }}
              >
                {validatingAddress ? 'Validerer...' : 'Valider adresse'}
              </Button>
              {formData.coordinates && (
                <Typography variant="caption" sx={{ color: '#4caf50', display: 'block', mt: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' } }}>
                  Koordinater: {formData.coordinates.lat.toFixed(6)}, {formData.coordinates.lng.toFixed(6)}
                </Typography>
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
                          '&:hover': { bgcolor: 'rgba(76,175,80,0.1)' },
                          '&.Mui-selected': { bgcolor: 'rgba(76,175,80,0.2)' },
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
                        sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }}
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
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
            position: { xs: 'sticky', sm: 'relative' },
            bottom: 0,
            bgcolor: '#1c2128',
          }}
        >
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            fullWidth={isMobile}
            sx={{ 
              color: 'rgba(255,255,255,0.87)', 
              minHeight: TOUCH_TARGET_SIZE,
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              ...focusVisibleStyles 
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
              bgcolor: '#4caf50',
              color: '#fff',
              fontWeight: 600,
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              minHeight: TOUCH_TARGET_SIZE,
              ...focusVisibleStyles,
              '&:hover': { bgcolor: '#43a047' },
            }}
          >
            {editingLocation ? 'Lagre' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
