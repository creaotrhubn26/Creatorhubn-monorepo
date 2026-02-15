import { useState, useId, useMemo, useEffect, type ReactNode, memo } from 'react';
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
  InputLabel,
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
  Divider,
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
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Movie as MovieIcon,
  Clear as ClearIcon,
  InterpreterMode as InterpreterModeIcon,
  Note as NoteIcon,
  Inventory as InventoryIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import { RolesIcon as TheaterComedyIcon, AuditionsIcon, CandidatesIcon, CalendarCustomIcon as CalendarIcon, LocationsIcon as LocationIcon, StatsIcon } from './icons/CastingIcons';
import { Schedule, Role, Candidate } from '../models/casting';
import { castingService } from '../services/castingService';
import { auditionPoolService, PoolAudition } from '../services/auditionPoolService';
import { useToast } from './ToastStack';

// WCAG 2.2 - 2.5.5 Target Size: minimum 44x44px touch targets
const TOUCH_TARGET_SIZE = 44;

// WCAG 2.2 - 2.4.7 Focus Visible: clear focus indicator
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #ffb800',
    outlineOffset: 2,
  },
};

type SortField = 'date' | 'status' | 'candidate' | 'role';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';
type StatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';

interface AuditionSchedulePanelProps {
  projectId: string;
  schedules: Schedule[];
  candidates: Candidate[];
  roles: Role[];
  availableScenes: { id: string; name: string }[];
  onSchedulesChange: () => void;
  onEditSchedule: (schedule: Schedule) => void;
  onCreateSchedule: () => void;
  onNavigateToTab: (tabIndex: number) => void;
  profession?: 'photographer' | 'videographer' | null;
}

function AuditionSchedulePanelInner({
  projectId,
  schedules,
  candidates,
  roles,
  availableScenes,
  onSchedulesChange,
  onEditSchedule,
  onCreateSchedule,
  onNavigateToTab,
}: AuditionSchedulePanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const titleId = useId();
  const statsId = useId();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [candidateFilter, setCandidateFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showStats, setShowStats] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [undoSnackbarOpen, setUndoSnackbarOpen] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Schedule | null>(null);
  const [poolMode, setPoolMode] = useState<'project' | 'pool'>('project');
  const [poolAuditions, setPoolAuditions] = useState<PoolAudition[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  const { showSuccess, showError } = useToast();
  
  const containerPadding = isMobile ? 2 : isTablet ? 3 : 4;

  const FAVORITES_NAMESPACE = 'virtualStudio_scheduleFavorites';

  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'schedule');
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
        await favoritesApi.set(projectId, 'schedule', values);
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
        if (e.key === 'n') { e.preventDefault(); onCreateSchedule(); }
        if (e.key === 'e') { e.preventDefault(); handleExportCSV(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#00d4ff';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Fullført';
      case 'cancelled': return 'Kansellert';
      default: return 'Planlagt';
    }
  };

  const getCandidateName = (candidateId: string) => 
    candidates.find(c => c.id === candidateId)?.name || 'Ukjent';
  
  const getRoleName = (roleId: string) => 
    roles.find(r => r.id === roleId)?.name || 'Ukjent';

  const getSceneName = (sceneId?: string) =>
    sceneId ? availableScenes.find(s => s.id === sceneId)?.name : null;

  // Render formatted notes matching ProductionDayView style
  const renderFormattedNotes = (notes: string): ReactNode => {
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
      const parseInlineFormatting = (text: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let keyCounter = 0;

        while (remaining.length > 0) {
          const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
          const italicMatch = remaining.match(/_(.+?)_/);

          const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
          const italicIndex = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;

          if (boldIndex === -1 && italicIndex === -1) {
            if (remaining) parts.push(remaining);
            break;
          }

          const usesBold = boldIndex !== -1 && (italicIndex === -1 || boldIndex < italicIndex);

          if (usesBold && boldMatch) {
            if (boldIndex > 0) parts.push(remaining.substring(0, boldIndex));
            parts.push(
              <Box component="span" key={`bold-${keyCounter++}`} sx={{ fontWeight: 700, color: '#ffb800' }}>
                {boldMatch[1]}
              </Box>
            );
            remaining = remaining.substring(boldIndex + boldMatch[0].length);
          } else if (italicMatch) {
            if (italicIndex > 0) parts.push(remaining.substring(0, italicIndex));
            parts.push(
              <Box component="span" key={`italic-${keyCounter++}`} sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.85)' }}>
                {italicMatch[1]}
              </Box>
            );
            remaining = remaining.substring(italicIndex + italicMatch[0].length);
          }
        }

        return parts.length > 0 ? parts : text;
      };

      const content = parseInlineFormatting(checkboxContent);

      if (isHeading) {
        return (
          <Typography
            key={lineIndex}
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              color: '#ffb800',
              mt: lineIndex > 0 ? 1.5 : 0,
              mb: 0.75,
              borderBottom: '2px solid rgba(255,184,0,0.3)',
              pb: 0.5,
            }}
          >
            {content}
          </Typography>
        );
      }

      if (isBullet) {
        return (
          <Box key={lineIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ffb800', mt: 1, flexShrink: 0 }} />
            <Typography sx={{ color: '#fff', lineHeight: 1.6, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>{content}</Typography>
          </Box>
        );
      }

      if (isNumbered && numberMatch) {
        return (
          <Box key={lineIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                minWidth: 20,
                height: 20,
                borderRadius: 1,
                bgcolor: 'rgba(255,184,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.75rem',
                color: '#ffb800',
                flexShrink: 0,
              }}
            >
              {numberMatch[1]}
            </Box>
            <Typography sx={{ color: '#fff', lineHeight: 1.6, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>{content}</Typography>
          </Box>
        );
      }

      if (isUncheckedBox || isCheckedBox) {
        return (
          <Box key={lineIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 18,
                height: 18,
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
              {isCheckedBox && <Typography sx={{ color: '#4caf50', fontWeight: 700, fontSize: '0.75rem' }}>✓</Typography>}
            </Box>
            <Typography
              sx={{
                color: isCheckedBox ? 'rgba(255,255,255,0.5)' : '#fff',
                lineHeight: 1.6,
                fontSize: { xs: '0.8rem', sm: '0.85rem' },
                textDecoration: isCheckedBox ? 'line-through' : 'none',
              }}
            >
              {content}
            </Typography>
          </Box>
        );
      }

      if (line.trim() === '') {
        return <Box key={lineIndex} sx={{ height: 8 }} />;
      }

      return (
        <Typography key={lineIndex} sx={{ color: '#fff', lineHeight: 1.6, fontSize: { xs: '0.8rem', sm: '0.85rem' }, mb: 0.25 }}>
          {content}
        </Typography>
      );
    });
  };

  // Filter and sort
  const filteredAndSortedSchedules = useMemo(() => {
    let result = [...schedules];
    
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        getCandidateName(s.candidateId).toLowerCase().includes(q) ||
        getRoleName(s.roleId).toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }
    
    // Date filter
    if (dateFilter) {
      result = result.filter(s => s.date === dateFilter);
    }
    
    // Candidate filter
    if (candidateFilter !== 'all') {
      result = result.filter(s => s.candidateId === candidateFilter);
    }
    
    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter(s => s.roleId === roleFilter);
    }
    
    // Sort - favorites first
    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'candidate':
          comparison = getCandidateName(a.candidateId).localeCompare(getCandidateName(b.candidateId));
          break;
        case 'role':
          comparison = getRoleName(a.roleId).localeCompare(getRoleName(b.roleId));
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [schedules, searchQuery, statusFilter, dateFilter, candidateFilter, roleFilter, sortField, sortDirection, favorites]);

  // Statistics
  const statistics = useMemo(() => ({
    total: schedules.length,
    scheduled: schedules.filter(s => s.status === 'scheduled').length,
    completed: schedules.filter(s => s.status === 'completed').length,
    cancelled: schedules.filter(s => s.status === 'cancelled').length,
    upcoming: schedules.filter(s => s.status === 'scheduled' && new Date(s.date) >= new Date()).length,
    favorites: favorites.size,
  }), [schedules, favorites]);

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
    if (selectedIds.size === filteredAndSortedSchedules.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedSchedules.map(s => s.id)));
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

  const handleDeleteWithUndo = async (schedule: Schedule) => {
    setLastDeleted(schedule);
    try {
      await castingService.deleteSchedule(projectId, schedule.id);
      onSchedulesChange();
      setUndoSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      setLastDeleted(null);
    }
  };

  const handleUndoDelete = async () => {
    if (lastDeleted) {
      try {
        await castingService.saveSchedule(projectId, lastDeleted);
        onSchedulesChange();
      } catch (error) {
        console.error('Failed to restore schedule:', error);
      }
      setLastDeleted(null);
    }
    setUndoSnackbarOpen(false);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Er du sikker på at du vil slette ${selectedIds.size} avtaler?`)) {
      try {
        await Promise.all(
          Array.from(selectedIds).map(id => castingService.deleteSchedule(projectId, id))
        );
        onSchedulesChange();
        setSelectedIds(new Set());
      } catch (error) {
        console.error('Failed to bulk delete schedules:', error);
      }
    }
  };

  const handleDuplicate = async (schedule: Schedule) => {
    const newSchedule: Schedule = {
      ...schedule,
      id: `schedule-${Date.now()}`,
      status: 'scheduled',
    };
    try {
      await castingService.saveSchedule(projectId, newSchedule);
      onSchedulesChange();
    } catch (error) {
      console.error('Failed to duplicate schedule:', error);
    }
  };

  const loadPoolAuditions = async () => {
    setPoolLoading(true);
    try {
      const auditions = await auditionPoolService.getPoolAuditions();
      setPoolAuditions(auditions);
    } catch (error) {
      console.error('Error loading pool auditions:', error);
    } finally {
      setPoolLoading(false);
    }
  };

  useEffect(() => {
    loadPoolAuditions();
  }, []);

  const handleSaveToPool = async (schedule: Schedule) => {
    try {
      const poolId = await auditionPoolService.saveScheduleToPool(schedule.id);
      if (poolId) {
        showSuccess('Audition lagret til pool', 3000);
        loadPoolAuditions();
      } else {
        showError('Kunne ikke lagre til pool', 3000);
      }
    } catch (error) {
      console.error('Error saving to pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const handleImportFromPool = async (poolAudition: PoolAudition) => {
    try {
      const newId = await auditionPoolService.importToProject(poolAudition.id, projectId);
      if (newId) {
        showSuccess(`${poolAudition.title} importert til prosjektet`, 3000);
        onSchedulesChange();
        setPoolMode('project');
      } else {
        showError('Kunne ikke importere audition', 3000);
      }
    } catch (error) {
      console.error('Error importing from pool:', error);
      showError('En feil oppstod', 3000);
    }
  };

  const handleDeleteFromPool = async (poolAuditionId: string) => {
    try {
      const success = await auditionPoolService.deleteFromPool(poolAuditionId);
      if (success) {
        showSuccess('Audition fjernet fra pool', 3000);
        loadPoolAuditions();
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
        alert('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateAuditionsHTML(project, filteredAndSortedSchedules, candidates, roles);

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
      console.error('Error exporting auditions:', error);
      alert('Kunne ikke eksportere auditions');
    }
  };

  const generateAuditionsHTML = (project: any, schedules: any[], candidates: any[], roles: any[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalSchedules = schedules.length;
    const completedSchedules = schedules.filter(s => s.status === 'completed').length;
    const scheduledSchedules = schedules.filter(s => s.status === 'scheduled').length;
    const completedPercent = totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0;

    const scheduleIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`;

    const getCandidateName = (candidateId: string) => candidates.find(c => c.id === candidateId)?.name || 'Ukjent';
    const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Ukjent';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Auditions</title>
  <style>
    @page { margin: 0; counter-increment: page; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.7; padding: 0; background: #fff; font-size: 14px; }
    .page { padding: 50px 60px 80px 60px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #8b5cf6; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #8b5cf6; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #8b5cf6; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #8b5cf6; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #8b5cf6; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .progress-bar { width: 100%; height: 6px; background: #e2e8f0; border-radius: 10px; margin-top: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 10px; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
    th:first-child { border-top-left-radius: 10px; }
    th:last-child { border-top-right-radius: 10px; }
    td { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 14px; font-weight: 400; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-scheduled { background: #00d4ff; color: white; }
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
        ${scheduleIconSVG}
        ${project.name} - Auditions
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${scheduleIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalSchedules}</span>
          <span class="summary-label">Totale Auditions</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${scheduledSchedules}</span>
          <span class="summary-label">Planlagte</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${completedSchedules}</span>
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
          <span class="section-icon">${scheduleIconSVG}</span>
          Auditions
        </div>
        <span class="section-count">${totalSchedules} audition${totalSchedules !== 1 ? 'er' : ''}</span>
      </div>
      <div class="section-content">
        ${schedules.length === 0
          ? '<div class="empty-state">Ingen auditions ennå</div>'
          : `<table>
          <thead>
            <tr>
              <th style="width: 12%;">Dato</th>
              <th style="width: 10%;">Tid</th>
              <th style="width: 20%;">Kandidat</th>
              <th style="width: 18%;">Rolle</th>
              <th style="width: 20%;">Lokasjon</th>
              <th style="width: 10%;">Status</th>
              <th style="width: 10%;">Notater</th>
            </tr>
          </thead>
          <tbody>
            ${schedules.map((s) => {
              const statusBadgeClass = s.status === 'completed' ? 'badge-completed' : s.status === 'cancelled' ? 'badge-cancelled' : 'badge-scheduled';
              const notes = s.notes || '-';
              return `<tr>
              <td>${new Date(s.date).toLocaleDateString('nb-NO')}</td>
              <td style="text-align: center;">${s.time}</td>
              <td><strong>${getCandidateName(s.candidateId)}</strong></td>
              <td>${getRoleName(s.roleId)}</td>
              <td style="font-size: 13px;">${s.location || '-'}</td>
              <td><span class="badge ${statusBadgeClass}">${getStatusLabel(s.status)}</span></td>
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
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFilter('');
    setCandidateFilter('all');
    setRoleFilter('all');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFilter || candidateFilter !== 'all' || roleFilter !== 'all';

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%' }}
    >
      {/* Header with Icon and Title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              borderRadius: 2,
              bgcolor: 'rgba(255, 184, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InterpreterModeIcon sx={{ fontSize: { xs: 24, sm: 28 }, color: '#ffb800' }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id={titleId}
              sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
            >
              Audition-planlegger
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Planlegg og administrer auditions
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Eksporter til CSV (Ctrl+E)">
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={handleExportCSV}
              sx={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Eksporter'}
            </Button>
          </Tooltip>
          <Tooltip title="Vis statistikk">
            <Button
              variant={showStats ? 'contained' : 'outlined'}
              startIcon={<StatsIcon />}
              onClick={() => setShowStats(!showStats)}
              sx={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: showStats ? '#000' : '#fff',
                bgcolor: showStats ? '#ffb800' : 'transparent',
                minHeight: TOUCH_TARGET_SIZE,
                ...focusVisibleStyles,
              }}
            >
              {!isMobile && 'Statistikk'}
            </Button>
          </Tooltip>
          <Tooltip title="Ny avtale (Ctrl+N)">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateSchedule}
              disabled={candidates.length === 0 || roles.length === 0}
              sx={{
                bgcolor: '#ffb800',
                color: '#000',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { bgcolor: '#e6a600' },
                '&:disabled': { bgcolor: 'rgba(255,184,0,0.3)' },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? '' : 'Ny avtale'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Project/Templates Toggle */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant={poolMode === 'project' ? 'contained' : 'outlined'}
          onClick={() => setPoolMode('project')}
          startIcon={<CalendarIcon />}
          sx={{
            bgcolor: poolMode === 'project' ? '#ffb800' : 'transparent',
            color: poolMode === 'project' ? '#000' : 'rgba(255,255,255,0.7)',
            borderColor: poolMode === 'project' ? '#ffb800' : 'rgba(255,255,255,0.2)',
            minHeight: TOUCH_TARGET_SIZE,
            '&:hover': { bgcolor: poolMode === 'project' ? '#e6a600' : 'rgba(255,255,255,0.05)' },
            ...focusVisibleStyles,
          }}
        >
          Prosjekt
          <Chip
            label={schedules.length}
            size="small"
            sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: 20, fontSize: '0.7rem' }}
          />
        </Button>
        <Button
          variant={poolMode === 'pool' ? 'contained' : 'outlined'}
          onClick={() => { setPoolMode('pool'); loadPoolAuditions(); }}
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
            label={poolAuditions.length}
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
            gap: { xs: 1, sm: 2 },
            mb: 3,
            p: { xs: 1.5, sm: 2 },
            bgcolor: 'rgba(255, 184, 0, 0.05)',
            borderRadius: 2,
            border: '1px solid rgba(255, 184, 0, 0.2)',
          }}
        >
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffb800' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffb800', fontWeight: 700 }}>{statistics.total}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Totalt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <CalendarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#00d4ff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#00d4ff', fontWeight: 700 }}>{statistics.upcoming}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Kommende</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#00d4ff' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#00d4ff', fontWeight: 700 }}>{statistics.scheduled}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Planlagt</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#10b981' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>{statistics.completed}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Fullført</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <AuditionsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ef4444' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ef4444', fontWeight: 700 }}>{statistics.cancelled}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Kansellert</Typography>
          </Box>
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <StarIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ffc107' }} />
            </Box>
            <Typography variant="h4" sx={{ color: '#ffc107', fontWeight: 700 }}>{statistics.favorites}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Favoritter</Typography>
          </Box>
        </Box>
      </Collapse>

      {/* Project View - only shown when in project mode */}
      {poolMode === 'project' && (
      <>
      {/* Search and Filter Controls */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, alignItems: { xs: 'stretch', sm: 'center' } }}>
          <TextField
            placeholder={isMobile ? 'Søk...' : 'Søk på kandidat, rolle, lokasjon...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            slotProps={{
              input: {
                startAdornment: <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', mr: 1 }} />,
                sx: { minHeight: TOUCH_TARGET_SIZE },
              },
              htmlInput: { 'aria-label': 'Søk i avtaler' },
            }}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#ffb800' },
              },
            }}
          />
          <TextField
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            size="small"
            slotProps={{
              input: { sx: { minHeight: TOUCH_TARGET_SIZE } },
              htmlInput: { 'aria-label': 'Filtrer på dato' },
            }}
            sx={{
              minWidth: { xs: '100%', sm: 160 },
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#ffb800' },
              },
            }}
          />
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 }, alignItems: { xs: 'stretch', sm: 'center' } }}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtrer etter status"
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb800' },
              }}
            >
              <MenuItem value="all">Alle statuser</MenuItem>
              <MenuItem value="scheduled">Planlagt</MenuItem>
              <MenuItem value="completed">Fullført</MenuItem>
              <MenuItem value="cancelled">Kansellert</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
            <Select
              value={candidateFilter}
              onChange={(e) => setCandidateFilter(e.target.value)}
              aria-label="Filtrer etter kandidat"
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb800' },
              }}
            >
              <MenuItem value="all">Alle kandidater</MenuItem>
              {candidates.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filtrer etter rolle"
              sx={{
                color: '#fff',
                minHeight: TOUCH_TARGET_SIZE,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffb800' },
              }}
            >
              <MenuItem value="all">Alle roller</MenuItem>
              {roles.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
            {hasActiveFilters && (
              <Tooltip title="Nullstill filtre">
                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    minHeight: TOUCH_TARGET_SIZE,
                    ...focusVisibleStyles,
                  }}
                >
                  <ClearIcon />
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Kortvisning">
              <Button
                variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('grid')}
                sx={{
                  minHeight: TOUCH_TARGET_SIZE,
                  minWidth: TOUCH_TARGET_SIZE,
                  bgcolor: viewMode === 'grid' ? 'rgba(255,184,0,0.2)' : 'transparent',
                  color: viewMode === 'grid' ? '#ffb800' : 'rgba(255,255,255,0.7)',
                  borderColor: viewMode === 'grid' ? '#ffb800' : 'rgba(255,255,255,0.2)',
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
                sx={{
                  minHeight: TOUCH_TARGET_SIZE,
                  minWidth: TOUCH_TARGET_SIZE,
                  bgcolor: viewMode === 'table' ? 'rgba(255,184,0,0.2)' : 'transparent',
                  color: viewMode === 'table' ? '#ffb800' : 'rgba(255,255,255,0.7)',
                  borderColor: viewMode === 'table' ? '#ffb800' : 'rgba(255,255,255,0.2)',
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
                  sx={{ bgcolor: '#ff4444', minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                >
                  <DeleteIcon />
                  <Box component="span" sx={{ ml: 0.5 }}>{selectedIds.size}</Box>
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {/* Results count */}
      {hasActiveFilters && (
        <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(255,184,0,0.1)', color: '#fff', '& .MuiAlert-icon': { color: '#ffb800' } }}>
          Viser {filteredAndSortedSchedules.length} av {schedules.length} avtaler
        </Alert>
      )}

      {/* Empty State */}
      {schedules.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 4,
            bgcolor: 'rgba(255, 184, 0, 0.03)',
            borderRadius: 3,
            border: '2px dashed rgba(255, 184, 0, 0.2)',
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 184, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              mb: 3,
            }}
          >
            <InterpreterModeIcon sx={{ fontSize: 40, color: '#ffb800' }} />
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
            Planlegg auditions og møter
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 4, maxWidth: 450, mx: 'auto' }}>
            {candidates.length === 0 || roles.length === 0
              ? 'Du trenger minst én rolle og én kandidat for å opprette avtaler.'
              : `Du har ${candidates.length} kandidat${candidates.length > 1 ? 'er' : ''} klare for planlegging.`
            }
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={onCreateSchedule}
              disabled={candidates.length === 0 || roles.length === 0}
              sx={{
                bgcolor: '#ffb800',
                color: '#000',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                minHeight: TOUCH_TARGET_SIZE,
                '&:hover': { bgcolor: '#e6a600', transform: 'translateY(-2px)' },
                '&:disabled': { bgcolor: 'rgba(255,184,0,0.3)', color: 'rgba(0,0,0,0.5)' },
                ...focusVisibleStyles,
              }}
            >
              Opprett avtale
            </Button>
            {(candidates.length === 0 || roles.length === 0) && (
              <Button
                variant="outlined"
                size="large"
                onClick={() => onNavigateToTab(candidates.length === 0 ? 2 : 1)}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  fontWeight: 600,
                  px: 4,
                  py: 1.5,
                  minHeight: TOUCH_TARGET_SIZE,
                  '&:hover': { borderColor: '#ffb800', bgcolor: 'rgba(255,184,0,0.1)' },
                  ...focusVisibleStyles,
                }}
              >
                {candidates.length === 0 ? 'Legg til kandidater' : 'Opprett roller'}
              </Button>
            )}
          </Box>
        </Box>
      ) : viewMode === 'table' ? (
        /* Table View */
        <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedSchedules.length && filteredAndSortedSchedules.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedSchedules.length}
                    onChange={handleSelectAll}
                    sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#ffb800' } }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)', width: 40 }} />
                <TableCell sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <TableSortLabel
                    active={sortField === 'date'}
                    direction={sortField === 'date' ? sortDirection : 'asc'}
                    onClick={() => handleSort('date')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#ffb800' } }}
                  >
                    Dato/Tid
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <TableSortLabel
                    active={sortField === 'candidate'}
                    direction={sortField === 'candidate' ? sortDirection : 'asc'}
                    onClick={() => handleSort('candidate')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#ffb800' } }}
                  >
                    Kandidat
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <TableSortLabel
                    active={sortField === 'role'}
                    direction={sortField === 'role' ? sortDirection : 'asc'}
                    onClick={() => handleSort('role')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#ffb800' } }}
                  >
                    Rolle
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}>Lokasjon</TableCell>
                <TableCell sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <TableSortLabel
                    active={sortField === 'status'}
                    direction={sortField === 'status' ? sortDirection : 'asc'}
                    onClick={() => handleSort('status')}
                    sx={{ color: '#fff', '&.Mui-active': { color: '#ffb800' } }}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedSchedules.map((schedule) => (
                <TableRow
                  key={schedule.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,184,0,0.05)' },
                    bgcolor: selectedIds.has(schedule.id) ? 'rgba(255,184,0,0.1)' : 'transparent',
                  }}
                  onClick={() => onEditSchedule(schedule)}
                >
                  <TableCell padding="checkbox" sx={{ borderColor: 'rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(schedule.id)}
                      onChange={() => handleToggleSelect(schedule.id)}
                      sx={{ color: 'rgba(255,255,255,0.87)', '&.Mui-checked': { color: '#ffb800' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ borderColor: 'rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={() => toggleFavorite(schedule.id)}
                      sx={{ color: favorites.has(schedule.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                    >
                      {favorites.has(schedule.id) ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 16, color: '#ffb800' }} />
                      {new Date(schedule.date).toLocaleDateString('nb-NO')} {schedule.time}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ fontSize: 16, color: '#10b981' }} />
                      {getCandidateName(schedule.candidateId)}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MovieIcon sx={{ fontSize: 16, color: '#00d4ff' }} />
                      {getRoleName(schedule.roleId)}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', borderColor: 'rgba(255,255,255,0.1)' }}>
                    {schedule.location || '-'}
                  </TableCell>
                  <TableCell sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <Chip
                      label={getStatusLabel(schedule.status)}
                      size="small"
                      sx={{ bgcolor: getStatusColor(schedule.status), color: '#fff', fontSize: '11px' }}
                    />
                  </TableCell>
                  <TableCell sx={{ borderColor: 'rgba(255,255,255,0.1)' }} onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Rediger">
                        <IconButton size="small" onClick={() => onEditSchedule(schedule)} sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton size="small" onClick={() => handleDuplicate(schedule)} sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <DuplicateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton size="small" onClick={() => handleDeleteWithUndo(schedule)} sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: '#ef4444' }, minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        /* Grid View - Responsive for iPad and Desktop */
        <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
          {filteredAndSortedSchedules.map((schedule) => {
            const isExpanded = expandedCards.has(schedule.id);
            const sceneName = getSceneName(schedule.sceneId);
            const statusColor = getStatusColor(schedule.status);
            const statusLabel = getStatusLabel(schedule.status);
            const candidateName = getCandidateName(schedule.candidateId);
            const roleName = getRoleName(schedule.roleId);

            return (
              <Grid key={schedule.id} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}>
                <Card
                  component="article"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: selectedIds.has(schedule.id) ? 'rgba(255,184,0,0.15)' : 'rgba(255,255,255,0.05)',
                    border: selectedIds.has(schedule.id) ? '2px solid #ffb800' : '1px solid rgba(255,255,255,0.1)',
                    borderLeft: `4px solid ${statusColor}`,
                    borderRadius: 2,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    },
                  }}
                  onClick={() => onEditSchedule(schedule)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onEditSchedule(schedule); }}
                >
                  {/* Date/Time Header */}
                  <Box
                    sx={{
                      width: '100%',
                      py: { xs: 1.5, sm: 2, md: 2.5 },
                      px: { xs: 1.5, sm: 2, md: 2.5 },
                      bgcolor: `${statusColor}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopRightRadius: 4,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
                      <Box
                        sx={{
                          width: { xs: 44, md: 52 },
                          height: { xs: 44, md: 52 },
                          borderRadius: 2,
                          bgcolor: `${statusColor}25`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CalendarIcon sx={{ fontSize: { xs: 24, md: 28 }, color: statusColor }} />
                      </Box>
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            color: '#fff',
                            fontWeight: 700,
                            lineHeight: 1.2,
                            fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                          }}
                        >
                          {new Date(schedule.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'rgba(255,255,255,0.87)',
                            fontWeight: 500,
                            fontSize: { xs: '0.8rem', md: '0.9rem' },
                          }}
                        >
                          kl. {schedule.time}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={statusLabel}
                        size="small"
                        sx={{
                          bgcolor: `${statusColor}20`,
                          color: statusColor,
                          fontWeight: 600,
                          fontSize: { xs: '10px', md: '11px' },
                          height: { xs: 22, md: 26 },
                          display: { xs: 'none', sm: 'flex' },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(schedule.id); }}
                        sx={{
                          color: favorites.has(schedule.id) ? '#ffc107' : 'rgba(255,255,255,0.4)',
                          minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                          minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                        }}
                      >
                        {favorites.has(schedule.id) ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Box>
                  </Box>

                  <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Card Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, md: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
                        <Checkbox
                          checked={selectedIds.has(schedule.id)}
                          onChange={() => handleToggleSelect(schedule.id)}
                          onClick={(e) => e.stopPropagation()}
                          sx={{
                            p: 0.5,
                            color: 'rgba(255,255,255,0.6)',
                            '&.Mui-checked': { color: '#ffb800' },
                            '& .MuiSvgIcon-root': { fontSize: { xs: 20, md: 24 } },
                          }}
                        />
                        <Box>
                          <Typography
                            variant="subtitle1"
                            component="h3"
                            sx={{
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                              lineHeight: 1.3,
                            }}
                          >
                            {candidateName}
                          </Typography>
                          {/* Status chip only on mobile (shown in header on tablet+) */}
                          <Chip
                            label={statusLabel}
                            size="small"
                            sx={{
                              bgcolor: `${statusColor}20`,
                              color: statusColor,
                              fontWeight: 600,
                              fontSize: { xs: '10px', md: '11px' },
                              height: { xs: 20, md: 24 },
                              display: { xs: 'flex', sm: 'none' },
                              mt: 0.5,
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    {/* Info Grid - Responsive layout */}
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: { xs: 1.5, md: 2 },
                      flex: 1,
                    }}>
                      {/* Role */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
                        <Box
                          sx={{
                            width: { xs: 32, md: 36 },
                            height: { xs: 32, md: 36 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(244,143,177,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <TheaterComedyIcon sx={{ fontSize: { xs: 16, md: 20 }, color: '#f48fb1' }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(255,255,255,0.87)',
                              display: 'block',
                              lineHeight: 1,
                              fontSize: { xs: '0.65rem', md: '0.7rem' },
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Rolle
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#fff',
                              fontWeight: 500,
                              fontSize: { xs: '0.85rem', md: '0.9rem' },
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {roleName}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Location */}
                      {schedule.location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 } }}>
                          <Box
                            sx={{
                              width: { xs: 32, md: 36 },
                              height: { xs: 32, md: 36 },
                              borderRadius: 1.5,
                              bgcolor: 'rgba(16,185,129,0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <LocationIcon sx={{ fontSize: { xs: 16, md: 20 }, color: '#10b981' }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgba(255,255,255,0.87)',
                                display: 'block',
                                lineHeight: 1,
                                fontSize: { xs: '0.65rem', md: '0.7rem' },
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              Lokasjon
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#fff',
                                fontWeight: 500,
                                fontSize: { xs: '0.85rem', md: '0.9rem' },
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {schedule.location}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>

                    {/* Tags */}
                    {sceneName && (
                      <Box sx={{ mt: { xs: 1.5, md: 2 }, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<MovieIcon sx={{ fontSize: { xs: 14, md: 16 } }} />}
                          label={sceneName}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(139,92,246,0.15)',
                            color: '#8b5cf6',
                            height: { xs: 24, md: 28 },
                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                          }}
                        />
                      </Box>
                    )}

                    {/* Expandable notes - matching ProductionDayView style with animated icon */}
                    {schedule.notes && (
                      <Box sx={{ mt: { xs: 1.5, md: 2 } }}>
                        <Button
                          size="small"
                          onClick={(e) => { e.stopPropagation(); toggleCardExpanded(schedule.id); }}
                          endIcon={isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                          sx={{
                            color: '#ffb800',
                            p: 0,
                            minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                            fontSize: { xs: '0.75rem', md: '0.8rem' },
                            '&:hover': { color: '#ffc933', bgcolor: 'rgba(255,184,0,0.1)' },
                            '@keyframes writing': {
                              '0%, 100%': { transform: 'rotate(-5deg) translateY(0px)' },
                              '25%': { transform: 'rotate(0deg) translateY(-1px)' },
                              '50%': { transform: 'rotate(5deg) translateY(0px)' },
                              '75%': { transform: 'rotate(0deg) translateY(1px)' },
                            },
                            '& .animated-note-icon': {
                              animation: 'writing 2.5s ease-in-out infinite',
                            },
                          }}
                        >
                          <NoteIcon className="animated-note-icon" sx={{ fontSize: { xs: 16, md: 18 }, mr: 0.5 }} />
                          {isExpanded ? 'Skjul notater' : 'Vis notater'}
                        </Button>
                        <Collapse in={isExpanded}>
                          <Box
                            sx={{
                              mt: 1,
                              p: { xs: 2, md: 2.5 },
                              borderRadius: 2,
                              bgcolor: 'rgba(255,184,0,0.08)',
                              border: '2px solid rgba(255,184,0,0.3)',
                              boxShadow: '0 4px 16px rgba(255,184,0,0.1)',
                              position: 'relative',
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '5px',
                                height: '100%',
                                bgcolor: '#ffb800',
                                borderRadius: '2px 0 0 2px',
                              },
                            }}
                          >
                            {/* Animated header with icon */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, pl: 1 }}>
                              <Box
                                sx={{
                                  width: { xs: 36, md: 40 },
                                  height: { xs: 36, md: 40 },
                                  borderRadius: 2,
                                  bgcolor: 'rgba(255,184,0,0.2)',
                                  border: '2px solid rgba(255,184,0,0.4)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  '@keyframes writing': {
                                    '0%, 100%': { transform: 'rotate(-5deg) translateY(0px)' },
                                    '25%': { transform: 'rotate(0deg) translateY(-2px)' },
                                    '50%': { transform: 'rotate(5deg) translateY(0px)' },
                                    '75%': { transform: 'rotate(0deg) translateY(2px)' },
                                  },
                                }}
                              >
                                <NoteIcon
                                  sx={{
                                    fontSize: { xs: 20, md: 24 },
                                    color: '#ffb800',
                                    animation: 'writing 2.5s ease-in-out infinite',
                                    filter: 'drop-shadow(0 2px 4px rgba(255,184,0,0.3))',
                                  }}
                                />
                              </Box>
                              <Typography
                                sx={{
                                  color: '#ffb800',
                                  fontWeight: 700,
                                  fontSize: { xs: '0.875rem', md: '1rem' },
                                }}
                              >
                                Notater
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                pl: 1,
                                bgcolor: 'rgba(0,0,0,0.2)',
                                p: 1.5,
                                borderRadius: 1.5,
                                border: '1px solid rgba(255,255,255,0.1)',
                              }}
                            >
                              {renderFormattedNotes(schedule.notes)}
                            </Box>
                          </Box>
                        </Collapse>
                      </Box>
                    )}

                    {/* Card Actions */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: { xs: 1.5, md: 2 },
                        mt: 'auto',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 } }}>
                        <Tooltip title="Rediger">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); onEditSchedule(schedule); }}
                            sx={{
                              minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              color: '#ffb800',
                              ...focusVisibleStyles,
                            }}
                          >
                            <EditIcon sx={{ fontSize: { xs: 18, md: 22 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Dupliser">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(schedule); }}
                            sx={{
                              minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { color: '#00d4ff' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DuplicateIcon sx={{ fontSize: { xs: 18, md: 22 } }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Slett">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleDeleteWithUndo(schedule); }}
                            sx={{
                              minWidth: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                              color: 'rgba(255,255,255,0.87)',
                              '&:hover': { color: '#ef4444' },
                              ...focusVisibleStyles,
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: { xs: 18, md: 22 } }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Button
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onEditSchedule(schedule); }}
                        sx={{
                          color: '#ffb800',
                          fontSize: { xs: '0.75rem', md: '0.85rem' },
                          fontWeight: 600,
                          minHeight: { xs: TOUCH_TARGET_SIZE, md: 48 },
                          px: { xs: 1, md: 2 },
                          '&:hover': { bgcolor: 'rgba(255,184,0,0.1)' },
                          ...focusVisibleStyles,
                        }}
                      >
                        Åpne detaljer
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
      </>
      )}

      {/* Templates View - shows saved audition templates when in templates mode */}
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
              Slik bruker du audition-maler
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1 }}>
              Maler lar deg lagre audition-oppsett for gjenbruk i fremtidige produksjoner.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'rgba(255,255,255,0.87)', '& li': { mb: 0.5, fontSize: '0.875rem' } }}>
              <li><strong>Lagre som mal:</strong> Klikk på lilla ikon på en prosjekt-audition</li>
              <li><strong>Importer:</strong> Klikk "Importer" for å kopiere malen til prosjektet</li>
              <li><strong>Slett:</strong> Fjern maler du ikke trenger lenger</li>
            </Box>
          </Box>

          {poolLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>Laster maler...</Typography>
            </Box>
          ) : poolAuditions.length === 0 ? (
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
                Ingen audition-maler ennå
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mb: 3, maxWidth: 400, mx: 'auto' }}>
                Lagre audition-oppsett som maler for gjenbruk i fremtidige produksjoner.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={{ xs: 1, sm: 2 }}>
              {poolAuditions.map((poolAudition) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={poolAudition.id}>
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
                          {poolAudition.title}
                        </Typography>
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
                      {poolAudition.description && (
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
                          {poolAudition.description}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                        {poolAudition.durationMinutes && (
                          <Chip
                            icon={<ScheduleIcon sx={{ fontSize: 14 }} />}
                            label={`${poolAudition.durationMinutes} min`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.87)', fontSize: '0.7rem' }}
                          />
                        )}
                        {poolAudition.location && (
                          <Chip
                            icon={<LocationIcon sx={{ fontSize: 14 }} />}
                            label={poolAudition.location}
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
                          onClick={() => handleImportFromPool(poolAudition)}
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
                            onClick={() => handleDeleteFromPool(poolAudition.id)}
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

      {/* Undo Snackbar */}
      <Snackbar
        open={undoSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setUndoSnackbarOpen(false)}
        message="Avtale slettet"
        action={
          <Button color="secondary" size="small" onClick={handleUndoDelete} sx={{ color: '#ffb800' }}>
            Angre
          </Button>
        }
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: '#333' } }}
      />
    </Box>
  );
}

export const AuditionSchedulePanel = memo(AuditionSchedulePanelInner);
