import React, { useState, useId, useMemo, useEffect, memo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tooltip,
  Checkbox,
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
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  GridView as GridViewIcon,
  ViewList as TableViewIcon,
  FileDownload as ExportIcon,
  FileDownload as DownloadIcon,
  Close as CloseIcon,
  ContentCopy as DuplicateIcon,
  People as PeopleIcon,
  Movie as MovieIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import { RolesIcon as TheaterComedyIcon, StatsIcon } from './icons/CastingIcons';
import { Role, CastingProject } from '../models/casting';
import { castingService } from '../services/castingService';
import { castingAuthService } from '../services/castingAuthService';
import { useToast } from './ToastStack';
import { useBrandingSettings } from '../hooks/useBrandingSettings';
import { rolePoolService, PoolRole } from '../services/rolePoolService';
import { RoleRoomEmptyState } from './icons/RoleRoomEmptyState';
import castingDirectorPng from './icons/Keep/roleroom_casting_director.png';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #00d4ff',
    outlineOffset: 2,
  },
};

type SortField = 'name' | 'status' | 'candidates' | 'scenes';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type StatusFilter = 'all' | 'open' | 'casting' | 'filled' | 'cancelled' | 'draft';

interface RoleManagementPanelProps {
  projectId: string;
  roles: Role[];
  onRolesChange: () => void;
  onEditRole: (role: Role) => void;
  onCreateRole: () => void;
  profession?: 'photographer' | 'videographer' | null;
}

function RoleManagementPanelInner({
  projectId,
  roles,
  onRolesChange,
  onEditRole,
  onCreateRole,
  profession,
}: RoleManagementPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();
  const branding = useBrandingSettings();

  // Unique IDs for accessibility
  const panelTitleId = useId();
  const dialogTitleId = useId();
  const dialogDescId = useId();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showStats, setShowStats] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [confirmDeletePoolRole, setConfirmDeletePoolRole] = useState<PoolRole | null>(null);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  const [deletedRole, setDeletedRole] = useState<Role | null>(null);
  
  // Pool mode state
  const [poolMode, setPoolMode] = useState<'project' | 'pool'>('project');
  const [poolRoles, setPoolRoles] = useState<PoolRole[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);

  // Load pool roles when switching to pool mode
  useEffect(() => {
    if (poolMode === 'pool') {
      loadPoolRoles();
    }
  }, [poolMode]);

  const loadPoolRoles = async () => {
    setPoolLoading(true);
    try {
      const roles = await rolePoolService.getPoolRoles();
      setPoolRoles(roles);
    } catch (error) {
      console.error('Error loading pool roles:', error);
      showError('Kunne ikke laste rollepool');
    } finally {
      setPoolLoading(false);
    }
  };

  const handleSaveToPool = async (role: Role) => {
    try {
      const poolId = await rolePoolService.saveRoleToPool(role.id);
      if (poolId) {
        showSuccess(`"${role.name}" lagret til rollepool`);
        loadPoolRoles();
      } else {
        showError('Kunne ikke lagre rolle til pool');
      }
    } catch (error) {
      console.error('Error saving role to pool:', error);
      showError('Feil ved lagring til pool');
    }
  };

  const handleImportFromPool = async (poolRole: PoolRole) => {
    if (!projectId) {
      showError('Ingen prosjekt valgt');
      return;
    }
    try {
      const newRoleId = await rolePoolService.importToProject(poolRole.id, projectId);
      if (newRoleId) {
        showSuccess(`"${poolRole.name}" importert til prosjektet`);
        onRolesChange();
        setPoolMode('project');
      } else {
        showError('Kunne ikke importere rolle');
      }
    } catch (error) {
      console.error('Error importing role from pool:', error);
      showError('Feil ved import fra pool');
    }
  };

  const handleDeleteFromPool = (poolRole: PoolRole) => {
    setConfirmDeletePoolRole(poolRole);
  };

  const executeDeleteFromPool = async () => {
    if (!confirmDeletePoolRole) return;
    const poolRole = confirmDeletePoolRole;
    setConfirmDeletePoolRole(null);
    try {
      const success = await rolePoolService.deleteFromPool(poolRole.id);
      if (success) {
        setPoolRoles(prev => prev.filter(r => r.id !== poolRole.id));
        showSuccess('Rolle fjernet fra pool');
      } else {
        showError('Kunne ikke fjerne rolle fra pool');
      }
    } catch (error) {
      console.error('Error deleting from pool:', error);
      showError('Feil ved sletting fra pool');
    }
  };

  const FAVORITES_NAMESPACE = 'virtualStudio_roleFavorites';

  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'role');
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
        await favoritesApi.set(projectId, 'role', values);
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
        if (e.key === 'n') {
          e.preventDefault();
          onCreateRole();
        } else if (e.key === 'e') {
          e.preventDefault();
          handleExportCSV();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper functions
  const getStatusColor = (status: Role['status']): string => {
    const colors: Record<string, string> = {
      open: '#00d4ff',
      casting: '#ffb800',
      filled: '#10b981',
      cancelled: '#ef4444',
      draft: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status: Role['status']): string => {
    const labels: Record<string, string> = {
      open: 'Åpen',
      casting: 'Casting pågår',
      filled: 'Besatt',
      cancelled: 'Kansellert',
      draft: 'Utkast',
    };
    return labels[status] || status;
  };

  // Filtering and sorting
  const filteredAndSortedRoles = useMemo(() => {
    let result = [...roles];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.requirements.skills?.some((s) => s.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
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
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'candidates':
          comparison = (a.candidateIds?.length || 0) - (b.candidateIds?.length || 0);
          break;
        case 'scenes':
          comparison = (a.sceneIds?.length || 0) - (b.sceneIds?.length || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [roles, searchQuery, statusFilter, sortField, sortDirection, favorites]);

  // Statistics
  const stats = useMemo(() => {
    const statusCount: Record<string, number> = {};
    roles.forEach((r) => {
      statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    });
    return {
      total: roles.length,
      open: statusCount['open'] || 0,
      casting: statusCount['casting'] || 0,
      filled: statusCount['filled'] || 0,
      favorites: favorites.size,
    };
  }, [roles, favorites]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const newFavs = new Set(prev);
      if (newFavs.has(id)) {
        newFavs.delete(id);
      } else {
        newFavs.add(id);
      }
      return newFavs;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedRoles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedRoles.map((r) => r.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDeleteWithUndo = async (role: Role) => {
    setDeletedRole(role);
    try {
      await castingService.deleteRole(projectId, role.id);
      onRolesChange();
      setUndoSnackbarOpen(true);
      showInfo(`🗑️ ${role.name} slettet - klikk "Angre" for å gjenopprette`, 6000);
    } catch (error) {
      console.error('Failed to delete role:', error);
      setDeletedRole(null);
    }
  };

  const handleUndoDelete = async () => {
    if (deletedRole) {
      try {
        await castingService.saveRole(projectId, deletedRole);
        onRolesChange();
        showSuccess(`↩️ ${deletedRole.name} gjenopprettet`, 3000);
      } catch (error) {
        console.error('Failed to restore role:', error);
      }
      setDeletedRole(null);
      setUndoSnackbarOpen(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => castingService.deleteRole(projectId, id))
      );
      setSelectedIds(new Set());
      onRolesChange();
    } catch (error) {
      console.error('Failed to bulk delete roles:', error);
    }
  };

  const handleDuplicate = async (role: Role) => {
    const newRole: Role = {
      ...role,
      id: `role-${Date.now()}`,
      name: `${role.name} (kopi)`,
      status: 'draft',
      candidateIds: [],
    };
    try {
      await castingService.saveRole(projectId, newRole);
      onRolesChange();
    } catch (error) {
      console.error('Failed to duplicate role:', error);
    }
  };

  const handleExportCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        alert('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateRolesHTML(project, filteredAndSortedRoles);

      // Create a new window for printing/viewing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Kunne ikke åpne eksport-vindu. Vennligst tillat popups.');
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Trigger print (which allows saving as PDF)
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error exporting roles:', error);
      alert('Kunne ikke eksportere roller');
    }
  };

  const generateRolesHTML = (project: any, roles: Role[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Calculate summary statistics
    const totalRoles = roles.length;
    const openRoles = roles.filter(r => r.status === 'open' || r.status === 'casting').length;
    const filledRoles = roles.filter(r => r.status === 'filled').length;
    const rolesFilledPercent = totalRoles > 0 ? Math.round((filledRoles / totalRoles) * 100) : 0;

    // SVG Icon for roles (Assignment/Clipboard)
    const roleIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Roller</title>
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
      border-bottom: 5px solid #00d4ff;
      padding: 30px 35px;
      margin: -50px -60px 40px -60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .title {
      font-size: 36px;
      font-weight: 800;
      color: #00d4ff;
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
      border-left: 6px solid #00d4ff;
      padding: 30px;
      margin-bottom: 45px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .summary-title {
      font-size: 20px;
      font-weight: 700;
      color: #00d4ff;
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
      color: #00d4ff;
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
      background: linear-gradient(90deg, #00d4ff 0%, #00b8e6 100%);
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
    td {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-size: 14px;
      font-weight: 400;
      vertical-align: top;
    }
    th {
      background: linear-gradient(135deg, #00d4ff 0%, #00b8e6 100%);
      color: white;
      font-weight: 700;
      padding: 18px 20px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border: none;
    }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
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
    .badge-draft { background: #94a3b8; color: white; }
    .badge-open { background: #00d4ff; color: white; }
    .badge-casting { background: #3b82f6; color: white; }
    .badge-filled { background: #10b981; color: white; }
    .badge-cancelled { background: #ef4444; color: white; }
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
        ${roleIconSVG}
        ${project.name} - Roller
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>

    <div class="summary">
      <div class="summary-title">
        ${roleIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalRoles}</span>
          <span class="summary-label">Totale Roller</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${openRoles}</span>
          <span class="summary-label">Åpne Roller</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${filledRoles}</span>
          <span class="summary-label">Fylte Roller</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${rolesFilledPercent}%"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${roleIconSVG}</span>
          Roller
        </div>
        <span class="section-count">${totalRoles} rolle${totalRoles !== 1 ? 'r' : ''}</span>
      </div>
      <div class="section-content">
        ${
          roles.length === 0
            ? '<div class="empty-state">Ingen roller ennå</div>'
            : `<table>
          <thead>
            <tr>
              <th style="width: 20%;">Navn</th>
              <th style="width: 12%;">Status</th>
              <th style="width: 25%;">Beskrivelse</th>
              <th style="width: 10%;">Alder</th>
              <th style="width: 20%;">Ferdigheter</th>
              <th style="width: 8%;">Kandidater</th>
              <th style="width: 5%;">Scener</th>
            </tr>
          </thead>
          <tbody>
            ${roles
              .map(
                (r) => {
                  const ageRange = r.requirements.age?.min && r.requirements.age?.max ? `${r.requirements.age.min}-${r.requirements.age.max}` : r.requirements.age?.min ? `${r.requirements.age.min}+` : '-';
                  const skills = r.requirements.skills?.join(', ') || '-';
                  const description = r.description || '-';
                  return `<tr>
              <td style="width: 20%;"><strong>${r.name}</strong></td>
              <td style="width: 12%;"><span class="badge badge-${r.status}">${getStatusLabel(r.status)}</span></td>
              <td style="width: 25%; font-size: 13px;">${description.length > 60 ? description.substring(0, 60) + '...' : description}</td>
              <td style="width: 10%; text-align: center;">${ageRange}</td>
              <td style="width: 20%; font-size: 13px;">${skills.length > 50 ? skills.substring(0, 50) + '...' : skills}</td>
              <td style="width: 8%; text-align: center;">${(r.candidateIds?.length || 0)}</td>
              <td style="width: 5%; text-align: center;">${(r.sceneIds?.length || 0)}</td>
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
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <Box
      component="section"
      aria-labelledby={panelTitleId}
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
              background: 'linear-gradient(135deg, rgba(233, 30, 99, 0.25) 0%, rgba(233, 30, 99, 0.15) 100%)',
              border: '2px solid rgba(233, 30, 99, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(233, 30, 99, 0.2)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(233, 30, 99, 0.3)',
              },
            }}
          >
            <TheaterComedyIcon
              sx={{
                color: '#f48fb1',
                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id={panelTitleId}
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #fff 0%, #f48fb1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Casting-roller
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
              <AssignmentIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, opacity: 0.7 }} />
              Administrer roller og krav for casting
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
              aria-label="Eksporter roller til CSV"
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
              <ExportIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
              {!isMobile && <Box component="span" sx={{ ml: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>Eksporter</Box>}
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
                color: showStats ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                borderColor: showStats ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              <StatsIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
            </Button>
          </Tooltip>

          <Tooltip title="Legg til rolle (Ctrl+N)">
            <Button
              variant="contained"
              onClick={onCreateRole}
              aria-label="Legg til ny rolle"
              sx={{
                bgcolor: '#00d4ff',
                color: '#000',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                flex: { xs: 1, sm: 'none' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#00b8e6' },
              }}
            >
              <AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
              {!isMobile && <Box component="span" sx={{ ml: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>Legg til</Box>}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Project/Templates Toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          p: 1,
          bgcolor: 'rgba(255,255,255,0.03)',
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Typography sx={{ color: 'rgba(255,255,255,0.87)', fontSize: '0.875rem', mr: 1 }}>
          Vis:
        </Typography>
        <Button
          variant={poolMode === 'project' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setPoolMode('project')}
          sx={{
            minHeight: 36,
            bgcolor: poolMode === 'project' ? '#f48fb1' : 'transparent',
            color: poolMode === 'project' ? '#000' : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'project' ? '#f48fb1' : 'rgba(255,255,255,0.3)',
            '&:hover': {
              bgcolor: poolMode === 'project' ? '#f06292' : 'rgba(255,255,255,0.1)',
            },
          }}
        >
          Prosjektroller ({roles.length})
        </Button>
        <Button
          variant={poolMode === 'pool' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setPoolMode('pool')}
          sx={{
            minHeight: 36,
            bgcolor: poolMode === 'pool' ? '#a78bfa' : 'transparent',
            color: poolMode === 'pool' ? '#000' : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'pool' ? '#a78bfa' : 'rgba(255,255,255,0.3)',
            '&:hover': {
              bgcolor: poolMode === 'pool' ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
            },
          }}
        >
          Maler ({poolRoles.length})
        </Button>
      </Box>

      {/* Templates View */}
      {poolMode === 'pool' && (
        <Box sx={{ mb: 3 }}>
          {/* Guide Box */}
          <Box
            sx={{
              mb: 3,
              p: 2,
              bgcolor: 'rgba(167, 139, 250, 0.08)',
              borderRadius: 2,
              border: '1px solid rgba(167, 139, 250, 0.2)',
            }}
          >
            <Typography variant="subtitle1" sx={{ color: '#a78bfa', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon sx={{ fontSize: 20 }} />
              Slik bruker du rollemaler
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
              Maler lar deg lagre rollebeskrivelser for gjenbruk i fremtidige prosjekter.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'rgba(255,255,255,0.87)', '& li': { mb: 0.5, fontSize: '0.875rem' } }}>
              <li><strong>Lagre som mal:</strong> Klikk på lilla ikon på en prosjektrolle</li>
              <li><strong>Importer:</strong> Klikk "Importer" for å kopiere malen til prosjektet</li>
              <li><strong>Slett:</strong> Fjern maler du ikke trenger lenger</li>
            </Box>
          </Box>
          
          {poolLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>Laster maler...</Typography>
            </Box>
          ) : poolRoles.length === 0 ? (
            <Box sx={{ 
              textAlign: 'center', 
              py: 6, 
              bgcolor: 'rgba(255,255,255,0.02)', 
              borderRadius: 2,
              border: '1px dashed rgba(255,255,255,0.1)',
            }}>
              <TheaterComedyIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
                Ingen rollemaler ennå
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Klikk på lilla ikon på prosjektroller for å lagre som mal
              </Typography>
            </Box>
          ) : (
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
            }}>
              {poolRoles.map((poolRole) => (
                <Card 
                  key={poolRole.id} 
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      borderColor: 'rgba(167,139,250,0.3)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TheaterComedyIcon sx={{ color: '#a78bfa', fontSize: 20 }} />
                      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
                        {poolRole.name}
                      </Typography>
                    </Box>
                    
                    {poolRole.roleType && (
                      <Chip
                        label={poolRole.roleType}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          mb: 1,
                          bgcolor: 'rgba(167,139,250,0.2)',
                          color: '#a78bfa',
                        }}
                      />
                    )}
                    
                    {poolRole.description && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'rgba(255,255,255,0.87)',
                          fontSize: '0.8rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: 1.5,
                        }}
                      >
                        {poolRole.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      pt: 1,
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      <Button
                        size="small"
                        onClick={() => handleImportFromPool(poolRole)}
                        sx={{
                          color: '#a78bfa',
                          fontSize: '0.75rem',
                          minHeight: TOUCH_TARGET_SIZE,
                          '&:hover': { bgcolor: 'rgba(167,139,250,0.1)' },
                        }}
                      >
                        Importer
                      </Button>
                      
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteFromPool(poolRole)}
                        sx={{
                          color: 'rgba(255,255,255,0.87)',
                          minWidth: TOUCH_TARGET_SIZE,
                          minHeight: TOUCH_TARGET_SIZE,
                          '&:hover': { 
                            color: '#ef4444',
                            bgcolor: 'rgba(239,68,68,0.1)',
                          },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Statistics Panel - Collapsible (only in project mode) */}
      <Collapse in={showStats && poolMode === 'project'}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            bgcolor: 'rgba(255,255,255,0.03)',
            borderRadius: 2,
          }}
          role="region"
          aria-label="Statistikk over roller"
        >
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#00d4ff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#00d4ff', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.total}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Totalt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#00d4ff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#00d4ff', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.open}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Åpne</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffb800' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffb800', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.casting}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Casting</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <TheaterComedyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#10b981' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.filled}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Besatt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' } }}>
              {stats.favorites}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>Favoritter</Typography>
          </Box>
        </Box>
      </Collapse>

      {/* Search and Filter Controls - Responsive (only in project mode) */}
      {poolMode === 'project' && (
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
          placeholder={isMobile ? 'Søk...' : 'Søk på rollenavn, beskrivelse, ferdigheter...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          slotProps={{
            input: {
              startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1, fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />,
              sx: { minHeight: TOUCH_TARGET_SIZE },
            },
            htmlInput: { 'aria-label': 'Søk i roller' },
          }}
          sx={{
            flex: 1,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
              height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
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
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff' },
            }}
          >
            <MenuItem value="all">Alle statuser</MenuItem>
            <MenuItem value="open">Åpen</MenuItem>
            <MenuItem value="casting">Casting pågår</MenuItem>
            <MenuItem value="filled">Besatt</MenuItem>
            <MenuItem value="cancelled">Kansellert</MenuItem>
            <MenuItem value="draft">Utkast</MenuItem>
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
                bgcolor: viewMode === 'grid' ? 'rgba(0,212,255,0.2)' : 'transparent',
                color: viewMode === 'grid' ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'grid' ? '#00d4ff' : 'rgba(255,255,255,0.2)',
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
                bgcolor: viewMode === 'table' ? 'rgba(0,212,255,0.2)' : 'transparent',
                color: viewMode === 'table' ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                borderColor: viewMode === 'table' ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
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
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  minHeight: TOUCH_TARGET_SIZE,
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
      )}

      {/* Results count (only in project mode) */}
      {poolMode === 'project' && (searchQuery || statusFilter !== 'all') && (
        <Alert
          severity="info"
          sx={{
            mb: 2,
            bgcolor: 'rgba(0,212,255,0.1)',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#00d4ff' },
          }}
        >
          Viser {filteredAndSortedRoles.length} av {roles.length} roller
        </Alert>
      )}

      {/* Empty state and role list (only in project mode) */}
      {poolMode === 'project' && (
        roles.length === 0 ? (
        <RoleRoomEmptyState
          iconSrc={castingDirectorPng}
          title="Kom i gang med casting"
          subtitle="Definer rollene du trenger for produksjonen din, og start å legge til kandidater."
          color="#00d4ff"
          buttonLabel="Opprett din første rolle"
          onAction={onCreateRole}
        />
      ) : filteredAndSortedRoles.length === 0 ? (
        <Box role="status" sx={{ textAlign: 'center', py: { xs: 4, sm: 6, md: 5, lg: 6, xl: 8 }, color: 'rgba(255,255,255,0.87)' }}>
          <SearchIcon sx={{ fontSize: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 }, mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }, opacity: 0.3 }} />
          <Typography variant="body1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Ingen treff på søket</Typography>
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
          <Table aria-label="Roller tabell" sx={{ minWidth: { xs: 600, sm: 700, md: 750, lg: 850, xl: 1100 } }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedRoles.length && filteredAndSortedRoles.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedRoles.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle roller"
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#00d4ff' } }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#fff', fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>Fav</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', '&:hover': { color: '#00d4ff' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', '&:hover': { color: '#00d4ff' } }}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>Alder</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'candidates'}
                    direction={sortField === 'candidates' ? sortDirection : 'asc'}
                    onClick={() => handleSort('candidates')}
                    sx={{ color: '#fff', '&:hover': { color: '#00d4ff' } }}
                  >
                    Kandidater
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'scenes'}
                    direction={sortField === 'scenes' ? sortDirection : 'asc'}
                    onClick={() => handleSort('scenes')}
                    sx={{ color: '#fff', '&:hover': { color: '#00d4ff' } }}
                  >
                    Scener
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' }, py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedRoles.map((role) => (
                <TableRow
                  key={role.id}
                  sx={{
                    bgcolor: selectedIds.has(role.id) ? 'rgba(0,212,255,0.1)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                  }}
                >
                  <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Checkbox
                      checked={selectedIds.has(role.id)}
                      onChange={() => handleToggleSelect(role.id)}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#00d4ff' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <IconButton onClick={() => toggleFavorite(role.id)} sx={{ color: favorites.has(role.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                      {favorites.has(role.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' } }}>{role.name}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip
                      label={getStatusLabel(role.status)}
                      size="small"
                      sx={{ bgcolor: `${getStatusColor(role.status)}20`, color: getStatusColor(role.status), fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                      {role.requirements.age ? `${role.requirements.age.min || '?'} - ${role.requirements.age.max || '?'}` : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip label={role.candidateIds?.length || 0} size="small" sx={{ bgcolor: 'rgba(0,212,255,0.2)', color: '#00d4ff', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }} />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip label={role.sceneIds?.length || 0} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#8b5cf6', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' }, height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 } }} />
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      <Tooltip title="Lagre til pool">
                        <IconButton onClick={() => handleSaveToPool(role)} sx={{ color: '#9c27b0', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <InventoryIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton onClick={() => handleDuplicate(role)} sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <DuplicateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton onClick={() => onEditRole(role)} sx={{ color: '#00d4ff', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <EditIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton onClick={() => handleDeleteWithUndo(role)} sx={{ color: '#ff4444', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
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
        <Grid container spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }}>
          {filteredAndSortedRoles.map((role) => {
            const statusColor = getStatusColor(role.status);
            const statusLabel = getStatusLabel(role.status);

            return (
              <Grid key={role.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card
                  component="article"
                  sx={{
                    bgcolor: selectedIds.has(role.id) ? 'rgba(244,143,177,0.15)' : 'rgba(255,255,255,0.05)',
                    border: selectedIds.has(role.id) ? '2px solid #f48fb1' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      borderColor: '#f48fb1',
                      boxShadow: '0 8px 24px rgba(244,143,177,0.2)',
                      transform: 'translateY(-2px)',
                    },
                    ...focusVisibleStyles,
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.75, xl: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Card Header with gradient */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                          checked={selectedIds.has(role.id)}
                          onChange={() => handleToggleSelect(role.id)}
                          sx={{ p: 0.5, color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#f48fb1' } }}
                        />
                        <Box sx={{ flex: 1 }}>
                          {/* Eye-catching Role Header */}
                          <Box
                            sx={{
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              mb: { xs: 1.25, sm: 1.5, md: 1.375, lg: 1.5, xl: 1.75 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: 2.5,
                              background: 'linear-gradient(135deg, rgba(244,143,177,0.25) 0%, rgba(233,30,99,0.15) 100%)',
                              border: '2px solid rgba(244,143,177,0.4)',
                              boxShadow: '0 4px 12px rgba(244,143,177,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: 'linear-gradient(90deg, #f48fb1 0%, #e91e63 50%, #f48fb1 100%)',
                              },
                            }}
                          >
                            {/* Role Icon */}
                            <Box
                              sx={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 },
                                height: { xs: 50, sm: 60, md: 55, lg: 65, xl: 75 },
                                borderRadius: 2,
                                background: 'linear-gradient(135deg, #f48fb1 0%, #e91e63 100%)',
                                border: '2px solid rgba(255,255,255,0.3)',
                                boxShadow: '0 4px 12px rgba(244,143,177,0.4)',
                              }}
                            >
                              <TheaterComedyIcon sx={{
                                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                                color: '#fff',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                              }} />
                            </Box>

                            {/* Role Name */}
                            <Box sx={{ flex: 1, zIndex: 1 }}>
                              <Typography
                                variant="h6"
                                component="h3"
                                sx={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: { xs: '1rem', sm: '1.125rem', md: '1.05rem', lg: '1.15rem', xl: '1.25rem' },
                                  lineHeight: 1.2,
                                  mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }}
                              >
                                {role.name}
                              </Typography>
                              <Chip
                                label={statusLabel}
                                size="small"
                                sx={{
                                  bgcolor: `${statusColor}30`,
                                  color: statusColor,
                                  fontWeight: 700,
                                  fontSize: { xs: '10px', sm: '11px', md: '10.5px', lg: '12px', xl: '14px' },
                                  height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                  border: `1px solid ${statusColor}50`,
                                }}
                              />
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                      <IconButton
                        onClick={() => toggleFavorite(role.id)}
                        aria-label={favorites.has(role.id) ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                        sx={{
                          minWidth: TOUCH_TARGET_SIZE,
                          minHeight: TOUCH_TARGET_SIZE,
                          color: favorites.has(role.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                          ...focusVisibleStyles,
                        }}
                      >
                        {favorites.has(role.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 32 } }} />}
                      </IconButton>
                    </Box>

                    {/* Info Cards - Enhanced with icons */}
                    <Stack spacing={{ xs: 1.25, sm: 1.5, md: 1.375, lg: 1.75, xl: 2 }} sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                      {role.description && (
                        <Box
                          sx={{
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(244,143,177,0.08)',
                            border: '1px solid rgba(244,143,177,0.2)',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'rgba(255,255,255,0.8)',
                              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                              display: '-webkit-box',
                              WebkitLineClamp: expandedCards.has(role.id) ? 'unset' : 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {role.description}
                          </Typography>
                        </Box>
                      )}

                      {/* Age Info Card */}
                      {role.requirements.age && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(244,143,177,0.1)',
                            border: '1px solid rgba(244,143,177,0.25)',
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(244,143,177,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <PersonIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 34 }, color: '#f48fb1' }} />
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
                              Alderskrav
                            </Typography>
                            <Typography
                              sx={{
                                color: '#fff',
                                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.05rem', lg: '1.15rem', xl: '1.3rem' },
                                fontWeight: 700,
                              }}
                            >
                              {role.requirements.age.min || '?'} - {role.requirements.age.max || '?'} år
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Candidates Info Card */}
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
                          <PeopleIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 34 }, color: '#a78bfa' }} />
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
                            Kandidater
                          </Typography>
                          <Typography
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.05rem', lg: '1.15rem', xl: '1.3rem' },
                              fontWeight: 700,
                            }}
                          >
                            {role.candidateIds?.length || 0} påmeldt
                          </Typography>
                        </Box>
                      </Box>
                    </Stack>

                    {/* Expandable content */}
                    <Collapse in={expandedCards.has(role.id)}>
                      <Box sx={{ mt: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        {role.requirements.skills && role.requirements.skills.length > 0 && (
                          <Box sx={{ mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                color: '#f48fb1',
                                fontWeight: 700,
                                mb: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                                fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.77rem', lg: '0.85rem', xl: '0.95rem' },
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Ferdigheter
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              {role.requirements.skills.map((skill, idx) => (
                                <Chip
                                  key={idx}
                                  label={skill}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(244,143,177,0.15)',
                                    color: '#f48fb1',
                                    fontSize: { xs: '10px', sm: '11px', md: '10.5px', lg: '12px', xl: '14px' },
                                    height: { xs: 24, sm: 26, md: 25, lg: 28, xl: 32 },
                                    fontWeight: 600,
                                    border: '1px solid rgba(244,143,177,0.3)',
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        {role.sceneIds && role.sceneIds.length > 0 && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                              borderRadius: 2,
                              bgcolor: 'rgba(139,92,246,0.08)',
                              border: '1px solid rgba(139,92,246,0.2)',
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
                              <MovieIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 34 }, color: '#a78bfa' }} />
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
                                Tilknyttede scener
                              </Typography>
                              <Typography
                                sx={{
                                  color: '#fff',
                                  fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.05rem', lg: '1.15rem', xl: '1.3rem' },
                                  fontWeight: 700,
                                }}
                              >
                                {role.sceneIds.length} scene{role.sceneIds.length !== 1 ? 'r' : ''}
                              </Typography>
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
                        borderTop: '2px solid rgba(244,143,177,0.2)',
                      }}
                    >
                      <Button
                        variant="contained"
                        size="medium"
                        onClick={() => toggleCardExpanded(role.id)}
                        endIcon={expandedCards.has(role.id) ? <CollapseIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <ExpandIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        sx={{
                          bgcolor: expandedCards.has(role.id)
                            ? 'rgba(244,143,177,0.25)'
                            : 'rgba(244,143,177,0.15)',
                          color: expandedCards.has(role.id) ? '#f48fb1' : '#fff',
                          fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.9rem', xl: '1rem' },
                          fontWeight: 600,
                          minHeight: TOUCH_TARGET_SIZE,
                          px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                          py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                          border: expandedCards.has(role.id)
                            ? '2px solid rgba(244,143,177,0.5)'
                            : '2px solid rgba(244,143,177,0.3)',
                          borderRadius: 2,
                          textTransform: 'none',
                          boxShadow: expandedCards.has(role.id)
                            ? '0 4px 12px rgba(244,143,177,0.3)'
                            : '0 2px 8px rgba(244,143,177,0.2)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(244,143,177,0.35)',
                            borderColor: 'rgba(244,143,177,0.6)',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 16px rgba(244,143,177,0.4)',
                          },
                          ...focusVisibleStyles,
                        }}
                      >
                        {expandedCards.has(role.id) ? 'Skjul detaljer' : 'Vis detaljer'}
                      </Button>
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        <Tooltip title="Lagre til pool">
                          <IconButton
                            onClick={() => handleSaveToPool(role)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#9c27b0',
                              '&:hover': { bgcolor: 'rgba(156, 39, 176, 0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <InventoryIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dupliser">
                          <IconButton
                            onClick={() => handleDuplicate(role)}
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
                            onClick={() => onEditRole(role)}
                            sx={{
                              minWidth: TOUCH_TARGET_SIZE,
                              minHeight: TOUCH_TARGET_SIZE,
                              color: '#f48fb1',
                              '&:hover': { bgcolor: 'rgba(244,143,177,0.1)' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <EditIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Slett">
                          <IconButton
                            onClick={() => handleDeleteWithUndo(role)}
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
      )
      )}

      {/* Pool View - shows pool roles when in pool mode */}
      {poolMode === 'pool' && (
        <Box>
          {poolRoles.length === 0 ? (
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
                Rollepool er tom
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3, maxWidth: 400, mx: 'auto' }}>
                Lagre roller fra prosjekter til poolen for gjenbruk i fremtidige produksjoner.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={{ xs: 1, sm: 2 }}>
              {poolRoles.map((poolRole) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={poolRole.id}>
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
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                          {poolRole.name}
                        </Typography>
                        <Chip
                          icon={<InventoryIcon sx={{ fontSize: 14 }} />}
                          label="Pool"
                          size="small"
                          sx={{
                            bgcolor: 'rgba(156, 39, 176, 0.2)',
                            color: '#ce93d8',
                            fontSize: '0.7rem',
                            height: 24,
                          }}
                        />
                      </Box>
                      {poolRole.description && (
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
                          {poolRole.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                        {poolRole.roleType && (
                          <Chip
                            label={poolRole.roleType}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleImportFromPool(poolRole)}
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
                            onClick={() => handleDeleteFromPool(poolRole)}
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
        message="Rolle slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#00d4ff', fontSize: isDesktop ? '1rem' : isTablet ? '0.875rem' : '0.8125rem' }}>
            Angre
          </Button>
        }
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: '#333' } }}
      />

      {/* Delete Pool Role Confirmation Dialog */}
      <Dialog
        open={!!confirmDeletePoolRole}
        onClose={() => setConfirmDeletePoolRole(null)}
        maxWidth="sm"
        PaperProps={{
          sx: {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {branding.tokens.labels.deleteProjectLabel || 'Slett'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {`Er du sikker på at du vil fjerne "${confirmDeletePoolRole?.name}" fra poolen?`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setConfirmDeletePoolRole(null)} variant="outlined"
            sx={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.2)', textTransform: 'none' }}>
            {branding.tokens.labels.cancelLabel || 'Avbryt'}
          </Button>
          <Button onClick={executeDeleteFromPool} variant="contained"
            sx={{ bgcolor: '#ff4444', color: '#fff', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#ff3333' } }}>
            {branding.tokens.labels.deleteProjectLabel || 'Slett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export const RoleManagementPanel = memo(RoleManagementPanelInner);
