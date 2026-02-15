import { useState, useId, useMemo, useEffect, type ReactElement } from 'react';
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
  Tooltip,
  useMediaQuery,
  useTheme,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Checkbox,
  Collapse,
  Alert,
  Snackbar,
  Avatar,
  Grow,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Search as SearchIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  FilterList as FilterListIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Download as DownloadIcon,
  ContentCopy as DuplicateIcon,
  Undo as UndoIcon,
  Calculate as CalculateIcon,
  Close as CloseIcon,
  Movie as MovieIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Videocam as VideocamIcon,
  CameraAlt as CameraAltIcon,
  Lightbulb as LightbulbIcon,
  Build as BuildIcon,
  GraphicEq as GraphicEqIcon,
  Face as FaceIcon,
  Checkroom as CheckroomIcon,
  MoreHoriz as MoreHorizIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Badge as BadgeIcon,
  PieChart as PieChartIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import { 
  TeamIcon as GroupsIcon, 
  PersonNameIcon, 
  EmailIcon as CustomEmailIcon, 
  PhoneIcon as CustomPhoneIcon,
  AddressIcon,
  RateIcon,
  SplitSheetIcon,
} from './icons/CastingIcons';
import { CrewMember, CrewRole } from '../models/casting';
import { castingService } from '../services/castingService';
import CrewAvailabilityDrawer from './CrewAvailabilityDrawer';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { useToast } from './ToastStack';

// Sort options
type SortField = 'name' | 'role' | 'rate' | 'availability';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

// WCAG 2.2 minimum touch target size (44x44px)
const TOUCH_TARGET_SIZE = 44;

// Shared focus styles for WCAG 2.4.7 Focus Visible
const focusVisibleStyles = {
  '&:focus-visible': {
    outline: '3px solid #00d4ff',
    outlineOffset: '2px',
  },
};



interface CrewManagementPanelProps {
  projectId: string;
  onUpdate?: () => void;
  profession?: 'photographer' | 'videographer' | null;
  totalBudget?: number; // Total project budget for split sheet percentage calculations
  onTotalBudgetChange?: (budget: number) => void;
}

export function CrewManagementPanel({ projectId, onUpdate, profession, totalBudget = 0, onTotalBudgetChange }: CrewManagementPanelProps) {
  const theme = useTheme();
  // iPad / tablet detection for responsive design
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const dialogTitleId = useId();
  const dialogDescId = useId();

  // Toast notifications
  const { showSuccess, showError, showInfo } = useToast();

  // Core state
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Load crew members when projectId changes
  useEffect(() => {
    const loadCrew = async () => {
      if (projectId) {
        try {
          const crew = await castingService.getCrew(projectId);
          setCrewMembers(Array.isArray(crew) ? crew : []);
        } catch (error) {
          console.error('Error loading crew:', error);
          setCrewMembers([]);
        }
      }
    };
    loadCrew();
  }, [projectId]);
  const [editingCrewMember, setEditingCrewMember] = useState<CrewMember | null>(null);
  const [formData, setFormData] = useState<Partial<CrewMember>>({
    name: '',
    role: 'other',
    contactInfo: {},
    availability: {},
    assignedScenes: [],
    notes: '',
  });

  // Local budget state (used if not provided via props)
  const [localBudget, setLocalBudget] = useState<number>(0);
  const effectiveBudget = totalBudget > 0 ? totalBudget : localBudget;

  // Calculate percentage based on rate and budget
  const calculatedPercentage = useMemo(() => {
    if (effectiveBudget > 0 && formData.rate && formData.rate > 0) {
      return (formData.rate / effectiveBudget) * 100;
    }
    return formData.splitSheet?.percentage ?? 0;
  }, [effectiveBudget, formData.rate, formData.splitSheet?.percentage]);

  // Auto-update percentage when rate or budget changes
  useEffect(() => {
    if (effectiveBudget > 0 && formData.rate && formData.rate > 0) {
      const newPercentage = (formData.rate / effectiveBudget) * 100;
      setFormData(prev => ({
        ...prev,
        splitSheet: {
          ...prev.splitSheet,
          percentage: newPercentage,
        }
      }));
    }
  }, [effectiveBudget, formData.rate]);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<CrewRole | 'all'>('all');
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Favorites with database sync
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  const FAVORITES_NAMESPACE = 'virtualStudio_crewFavorites';
  
  // Load favorites from database (with settings cache fallback)
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const { favoritesApi } = await import('@/services/castingApiService');
        const dbFavorites = await favoritesApi.get(projectId, 'crew');
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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deletedCrew, setDeletedCrew] = useState<CrewMember | null>(null);
  const [showUndoSnackbar, setShowUndoSnackbar] = useState(false);
  const [showCostCalculator, setShowCostCalculator] = useState(false);
  const [costStartDate, setCostStartDate] = useState('');
  const [costEndDate, setCostEndDate] = useState('');

  // Profession-specific crew role priorities
  const getCrewRoles = (): CrewRole[] => {
    const allRoles: CrewRole[] = [
      'director',
      'producer',
      'casting_director',
      'production_manager',
      'cinematographer',
      'camera_operator',
      'camera_assistant',
      'drone_pilot',
      'video_editor',
      'colorist',
      'gaffer',
      'grip',
      'sound_engineer',
      'audio_mixer',
      'vfx_artist',
      'motion_graphics',
      'production_assistant',
      'script_supervisor',
      'location_manager',
      'production_designer',
      'makeup_artist',
      'wardrobe',
      'stylist',
      'collaborator',
      'other',
    ];
    
    if (profession === 'photographer') {
      // Prioritize photographer-relevant roles
      return [
        'camera_operator',
        'camera_assistant',
        'makeup_artist',
        'stylist',
        'wardrobe',
        'producer',
        'production_manager',
        'gaffer',
        'grip',
        'director',
        'casting_director',
        'production_assistant',
        'location_manager',
        'collaborator',
        'other',
      ];
    } else if (profession === 'videographer') {
      // Prioritize videographer-relevant roles
      return [
        'director',
        'producer',
        'cinematographer',
        'camera_operator',
        'drone_pilot',
        'video_editor',
        'colorist',
        'sound_engineer',
        'audio_mixer',
        'gaffer',
        'grip',
        'camera_assistant',
        'production_assistant',
        'script_supervisor',
        'location_manager',
        'production_designer',
        'vfx_artist',
        'motion_graphics',
        'production_manager',
        'casting_director',
        'makeup_artist',
        'wardrobe',
        'stylist',
        'collaborator',
        'other',
      ];
    }
    
    return allRoles;
  };

  const crewRoles = getCrewRoles();

  const getRoleLabel = (role: CrewRole): string => {
    const labels: Record<CrewRole, string> = {
      director: 'Regissør',
      producer: 'Produsent',
      casting_director: 'Castingansvarlig',
      production_manager: 'Produksjonsleder',
      cinematographer: 'Filmfotograf',
      camera_operator: 'Kameraoperatør',
      camera_assistant: 'Kameraassistent',
      drone_pilot: 'Dronepilot',
      video_editor: 'Videoeditor',
      colorist: 'Kolorist',
      gaffer: 'Gaffer',
      grip: 'Grip',
      sound_engineer: 'Lydtekniker',
      audio_mixer: 'Lydmikser',
      vfx_artist: 'VFX-artist',
      motion_graphics: 'Motion Graphics',
      production_assistant: 'Produksjonsassistent',
      script_supervisor: 'Script Supervisor',
      location_manager: 'Lokasjonsansvarlig',
      production_designer: 'Produksjonsdesigner',
      makeup_artist: 'Sminkør',
      wardrobe: 'Kostyme',
      stylist: 'Stylist',
      collaborator: 'Samarbeidspartner',
      other: 'Annet',
    };
    return labels[role] || role;
  };

  const getRoleIcon = (role: CrewRole): ReactElement => {
    const icons: Record<CrewRole, ReactElement> = {
      director: <MovieIcon sx={{ fontSize: '1rem' }} />,
      producer: <BusinessIcon sx={{ fontSize: '1rem' }} />,
      casting_director: <PeopleIcon sx={{ fontSize: '1rem' }} />,
      production_manager: <SupervisorAccountIcon sx={{ fontSize: '1rem' }} />,
      cinematographer: <VideocamIcon sx={{ fontSize: '1rem' }} />,
      camera_operator: <VideocamIcon sx={{ fontSize: '1rem' }} />,
      camera_assistant: <CameraAltIcon sx={{ fontSize: '1rem' }} />,
      drone_pilot: <CameraAltIcon sx={{ fontSize: '1rem' }} />,
      video_editor: <MovieIcon sx={{ fontSize: '1rem' }} />,
      colorist: <MovieIcon sx={{ fontSize: '1rem' }} />,
      gaffer: <LightbulbIcon sx={{ fontSize: '1rem' }} />,
      grip: <BuildIcon sx={{ fontSize: '1rem' }} />,
      sound_engineer: <GraphicEqIcon sx={{ fontSize: '1rem' }} />,
      audio_mixer: <GraphicEqIcon sx={{ fontSize: '1rem' }} />,
      vfx_artist: <MovieIcon sx={{ fontSize: '1rem' }} />,
      motion_graphics: <MovieIcon sx={{ fontSize: '1rem' }} />,
      production_assistant: <PersonIcon sx={{ fontSize: '1rem' }} />,
      script_supervisor: <PersonIcon sx={{ fontSize: '1rem' }} />,
      location_manager: <PersonIcon sx={{ fontSize: '1rem' }} />,
      production_designer: <PersonIcon sx={{ fontSize: '1rem' }} />,
      makeup_artist: <FaceIcon sx={{ fontSize: '1rem' }} />,
      wardrobe: <CheckroomIcon sx={{ fontSize: '1rem' }} />,
      stylist: <CheckroomIcon sx={{ fontSize: '1rem' }} />,
      collaborator: <PeopleIcon sx={{ fontSize: '1rem' }} />,
      other: <MoreHorizIcon sx={{ fontSize: '1rem' }} />,
    };
    return icons[role] || <MoreHorizIcon sx={{ fontSize: '1rem' }} />;
  };

  // Check if crew member is currently available
  const isAvailableNow = (member: CrewMember): boolean => {
    if (!member.availability?.startDate || !member.availability?.endDate) return true;
    const today = new Date().toISOString().split('T')[0];
    return member.availability.startDate <= today && member.availability.endDate >= today;
  };

  // Statistics calculations
  const stats = useMemo(() => {
    const roleCount: Record<string, number> = {};
    let totalRate = 0;
    let availableCount = 0;

    crewMembers.forEach(member => {
      roleCount[member.role] = (roleCount[member.role] || 0) + 1;
      if (member.rate) totalRate += member.rate;
      if (isAvailableNow(member)) availableCount++;
    });

    return {
      total: crewMembers.length,
      roleCount,
      totalDailyRate: totalRate,
      availableNow: availableCount,
    };
  }, [crewMembers]);

  // Filtered and sorted crew members
  const filteredAndSortedCrew = useMemo(() => {
    let result = [...crewMembers];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(member =>
        member.name.toLowerCase().includes(query) ||
        member.contactInfo?.email?.toLowerCase().includes(query) ||
        member.contactInfo?.phone?.includes(query) ||
        getRoleLabel(member.role).toLowerCase().includes(query)
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      result = result.filter(member => member.role === filterRole);
    }

    // Availability filter
    if (filterAvailable) {
      result = result.filter(member => isAvailableNow(member));
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'no');
          break;
        case 'role':
          comparison = getRoleLabel(a.role).localeCompare(getRoleLabel(b.role), 'no');
          break;
        case 'rate':
          comparison = (a.rate || 0) - (b.rate || 0);
          break;
        case 'availability':
          comparison = (a.availability?.startDate || '').localeCompare(b.availability?.startDate || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [crewMembers, searchQuery, filterRole, filterAvailable, sortField, sortDirection]);

  // Bulk operations
  const handleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedCrew.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedCrew.map(m => m.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Er du sikker på at du vil slette ${selectedIds.size} crewmedlem(mer)?`)) {
      try {
        for (const id of selectedIds) {
          await castingService.deleteCrew(projectId, id);
        }
        const crew = await castingService.getCrew(projectId);
        setCrewMembers(Array.isArray(crew) ? crew : []);
        setSelectedIds(new Set());
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error deleting crew:', error);
        showError('Feil ved sletting av crewmedlemmer');
      }
    }
  };

  // Copy to clipboard
  const handleCopy = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Toggle favorite with database sync
  const toggleFavorite = async (id: string) => {
    const newFavorites = new Set(favorites);
    const isAdding = !newFavorites.has(id);
    if (isAdding) {
      newFavorites.add(id);
    } else {
      newFavorites.delete(id);
    }
    setFavorites(newFavorites);
    if (favoritesLoaded) {
      await settingsService.setSetting(FAVORITES_NAMESPACE, [...newFavorites], { projectId });
    }
    try {
      const { favoritesApi } = await import('@/services/castingApiService');
      if (isAdding) {
        await favoritesApi.add(projectId, 'crew', id);
      } else {
        await favoritesApi.remove(projectId, 'crew', id);
      }
    } catch (error) {
      console.warn('Database sync failed:', error);
    }
  };

  // Toggle expanded card
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get avatar color based on role
  const getAvatarColor = (role: CrewRole): string => {
    const colors: Record<CrewRole, string> = {
      director: '#ef4444', // Red for leadership
      producer: '#ef4444', // Red for leadership
      casting_director: '#673ab7',
      production_manager: '#3f51b5',
      cinematographer: '#8b5cf6', // Purple for camera
      camera_operator: '#8b5cf6', // Purple for camera
      camera_assistant: '#a78bfa',
      drone_pilot: '#8b5cf6', // Purple for camera
      video_editor: '#f59e0b', // Orange for post-production
      colorist: '#f59e0b', // Orange for post-production
      gaffer: '#3b82f6', // Blue for lighting
      grip: '#3b82f6', // Blue for grip
      sound_engineer: '#06b6d4', // Cyan for audio
      audio_mixer: '#06b6d4', // Cyan for audio
      vfx_artist: '#f59e0b', // Orange for post-production
      motion_graphics: '#f59e0b', // Orange for post-production
      production_assistant: '#22c55e', // Green for production support
      script_supervisor: '#22c55e', // Green for production support
      location_manager: '#22c55e', // Green for production support
      production_designer: '#22c55e', // Green for production support
      makeup_artist: '#ec4899',
      wardrobe: '#ec4899',
      stylist: '#ec4899',
      collaborator: '#3b82f6',
      other: '#607d8b',
    };
    return colors[role] || '#607d8b';
  };

  // Export to HTML (was CSV)
  const exportToCSV = async () => {
    try {
      const project = await castingService.getProject(projectId);
      if (!project) {
        alert('Prosjekt ikke funnet');
        return;
      }

      const htmlContent = generateCrewHTML(project, filteredAndSortedCrew);

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
      console.error('Error exporting crew:', error);
      alert('Kunne ikke eksportere crewliste');
    }
  };

  const generateCrewHTML = (project: any, crew: any[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalCrew = crew.length;
    const crewByRole: Record<string, number> = {};
    crew.forEach(member => {
      crewByRole[member.role] = (crewByRole[member.role] || 0) + 1;
    });

    const crewIconSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.name} - Team</title>
  <style>
    @page { margin: 0; counter-increment: page; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.7; padding: 0; background: #fff; font-size: 14px; }
    .page { padding: 50px 60px 80px 60px; max-width: 210mm; margin: 0 auto; min-height: 297mm; position: relative; }
    .header { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 5px solid #00d4ff; padding: 30px 35px; margin: -50px -60px 40px -60px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .title { font-size: 36px; font-weight: 800; color: #00d4ff; margin-bottom: 10px; letter-spacing: -1px; line-height: 1.2; display: flex; align-items: center; gap: 12px; }
    .title svg { flex-shrink: 0; }
    .subtitle { color: #64748b; font-size: 15px; font-weight: 500; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 6px solid #00d4ff; padding: 30px; margin-bottom: 45px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .summary-title { font-size: 20px; font-weight: 700; color: #00d4ff; margin-bottom: 25px; letter-spacing: -0.3px; display: flex; align-items: center; gap: 12px; }
    .summary-title svg { flex-shrink: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; }
    .summary-item { background: white; padding: 25px 20px; border-radius: 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .summary-number { font-size: 36px; font-weight: 800; color: #00d4ff; display: block; margin-bottom: 8px; line-height: 1; }
    .summary-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; display: block; }
    .section { margin-bottom: 50px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; padding-bottom: 15px; border-bottom: 3px solid #e2e8f0; }
    .section-title { font-size: 24px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; letter-spacing: -0.4px; }
    .section-icon { display: inline-flex; align-items: center; }
    .section-icon svg { flex-shrink: 0; }
    .section-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; border: 1px solid #e2e8f0; }
    .section-content { background: #fafbfc; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
    table { width: 100%; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #00d4ff 0%, #00b8e6 100%); color: white; font-weight: 700; padding: 18px 20px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: none; }
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
        ${crewIconSVG}
        ${project.name} - Team
      </div>
      <div class="subtitle">Eksportert: ${dateStr}</div>
    </div>
    <div class="summary">
      <div class="summary-title">
        ${crewIconSVG}
        Oversikt
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-number">${totalCrew}</span>
          <span class="summary-label">Totale Teammedlemmer</span>
        </div>
        <div class="summary-item">
          <span class="summary-number">${Object.keys(crewByRole).length}</span>
          <span class="summary-label">Forskjellige Roller</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">${crewIconSVG}</span>
          Team
        </div>
        <span class="section-count">${totalCrew} medlem${totalCrew !== 1 ? 'mer' : ''}</span>
      </div>
      <div class="section-content">
        ${crew.length === 0
          ? '<div class="empty-state">Ingen teammedlemmer ennå</div>'
          : `<table>
          <thead>
            <tr>
              <th style="width: 18%;">Navn</th>
              <th style="width: 12%;">Rolle</th>
              <th style="width: 15%;">E-post</th>
              <th style="width: 12%;">Telefon</th>
              <th style="width: 18%;">Adresse</th>
              <th style="width: 8%;">Fast honorar</th>
              <th style="width: 12%;">Tilgjengelig</th>
              <th style="width: 5%;">Notater</th>
            </tr>
          </thead>
          <tbody>
            ${crew.map((member) => {
              const availability = member.availability?.startDate && member.availability?.endDate 
                ? `${new Date(member.availability.startDate).toLocaleDateString('nb-NO')} - ${new Date(member.availability.endDate).toLocaleDateString('nb-NO')}` 
                : member.availability?.startDate 
                  ? `Fra ${new Date(member.availability.startDate).toLocaleDateString('nb-NO')}` 
                  : '-';
              const notes = member.notes || '-';
              return `<tr>
              <td><strong>${member.name}</strong></td>
              <td>${getRoleLabel(member.role)}</td>
              <td style="font-size: 13px;">${member.contactInfo?.email || '-'}</td>
              <td style="font-size: 13px;">${member.contactInfo?.phone || '-'}</td>
              <td style="font-size: 13px;">${member.contactInfo?.address || '-'}</td>
              <td style="text-align: center;">${member.rate ? `${member.rate} kr` : '-'}</td>
              <td style="font-size: 13px;">${availability}</td>
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

  // Duplicate crew member
  const handleDuplicate = async (member: CrewMember) => {
    try {
      const duplicate: CrewMember = {
        ...member,
        id: `crew-${Date.now()}`,
        name: `${member.name} (kopi)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveCrew(projectId, duplicate);
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error duplicating crew member:', error);
      showError('Feil ved duplisering av crewmedlem');
    }
  };

  // Delete with undo support
  const handleDeleteWithUndo = async (crewId: string) => {
    const member = crewMembers.find(m => m.id === crewId);
    if (!member) return;

    try {
      setDeletedCrew(member);
      await castingService.deleteCrew(projectId, crewId);
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);
      setShowUndoSnackbar(true);
      showInfo(`🗑️ ${member.name} slettet - klikk "Angre" for å gjenopprette`, 6000);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting crew member:', error);
      showError('Feil ved sletting av crewmedlem');
    }
  };

  // Undo delete
  const handleUndoDelete = async () => {
    if (deletedCrew) {
      try {
        await castingService.saveCrew(projectId, deletedCrew);
        const crew = await castingService.getCrew(projectId);
        setCrewMembers(Array.isArray(crew) ? crew : []);
        showSuccess(`↩️ ${deletedCrew.name} gjenopprettet`, 3000);
        setDeletedCrew(null);
        setShowUndoSnackbar(false);
        if (onUpdate) onUpdate();
      } catch (error) {
        console.error('Error undoing delete:', error);
        showError('Feil ved gjenoppretting av crewmedlem');
      }
    }
  };

  // Calculate cost for date range
  const calculateCost = useMemo(() => {
    if (!costStartDate || !costEndDate) return null;
    const start = new Date(costStartDate);
    const end = new Date(costEndDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days <= 0) return null;

    const selectedCrewForCost = selectedIds.size > 0
      ? crewMembers.filter(m => selectedIds.has(m.id))
      : crewMembers;

    const totalDailyRate = selectedCrewForCost.reduce((sum, m) => sum + (m.rate || 0), 0);
    return {
      days,
      dailyRate: totalDailyRate,
      total: days * totalDailyRate,
      crewCount: selectedCrewForCost.length,
    };
  }, [costStartDate, costEndDate, crewMembers, selectedIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N to add new crew
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !dialogOpen) {
        e.preventDefault();
        handleOpenDialog();
      }
      // Escape to close dialog
      if (e.key === 'Escape' && dialogOpen) {
        handleCloseDialog();
      }
      // Ctrl+E to export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !dialogOpen) {
        e.preventDefault();
        exportToCSV();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen]);

  const handleOpenDialog = (crewMember?: CrewMember) => {
    if (crewMember) {
      setEditingCrewMember(crewMember);
      setFormData(crewMember);
    } else {
      setEditingCrewMember(null);
      // Set profession-specific default role
      const defaultRole: CrewRole = profession === 'photographer' 
        ? 'camera_operator' 
        : profession === 'videographer' 
        ? 'director' 
        : 'other';
      setFormData({
        name: '',
        role: defaultRole,
        contactInfo: {},
        availability: {},
        assignedScenes: [],
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCrewMember(null);
    setFormData({
      name: '',
      role: 'other',
      contactInfo: {},
      availability: {},
      assignedScenes: [],
      notes: '',
    });
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      showError('⚠️ Navn er påkrevd');
      return;
    }

    try {
      const crewMember: CrewMember = editingCrewMember
        ? {
            ...editingCrewMember,
            ...formData,
            updatedAt: new Date().toISOString(),
          }
        : {
            id: `crew-${Date.now()}`,
            name: formData.name || '',
            role: formData.role || 'other',
            contactInfo: formData.contactInfo || {},
            availability: formData.availability || {},
            assignedScenes: formData.assignedScenes || [],
            rate: formData.rate,
            notes: formData.notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      await castingService.saveCrew(projectId, crewMember);
      const crew = await castingService.getCrew(projectId);
      setCrewMembers(Array.isArray(crew) ? crew : []);

      // Show success notification
      if (editingCrewMember) {
        showSuccess(`✅ ${formData.name} oppdatert`, 3000);
      } else {
        showSuccess(`👤 ${formData.name} lagt til i teamet`, 3000);
      }

      handleCloseDialog();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error saving crew member:', error);
      showError('Feil ved lagring av crewmedlem');
    }
  };

  // Responsive padding for iPad/tablet/mobile
  const containerPadding = { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 };

  return (
    <Box
      component="section"
      role="region"
      aria-label="Crewmedlem-administrasjon"
      sx={{ p: containerPadding, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
    >
      {/* Header with title and add button - Responsive */}
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
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(0, 212, 255, 0.15) 100%)',
              border: '2px solid rgba(0, 212, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 212, 255, 0.2)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0 6px 16px rgba(0, 212, 255, 0.3)',
              },
            }}
          >
            <GroupsIcon
              sx={{
                color: '#4dd0e1',
                fontSize: { xs: 26, sm: 32, md: 30, lg: 36, xl: 42 },
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
              }}
            />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              id="crew-panel-title"
              sx={{
                color: '#fff',
                fontWeight: 800,
                fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.4rem', lg: '1.6rem', xl: '2rem' },
                lineHeight: 1.2,
                letterSpacing: '-0.5px',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                background: 'linear-gradient(135deg, #fff 0%, #4dd0e1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Produksjonsteam
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
              <BadgeIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, opacity: 0.7 }} />
              Administrer crew og roller
            </Typography>
          </Box>
        </Box>

        {/* Action buttons - stack on mobile, row on larger screens */}
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.5, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
            flexWrap: 'wrap',
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
          }}
        >
          {selectedIds.size > 0 && (
            <Tooltip title={`Slett ${selectedIds.size} valgte`} arrow>
              <Button
                variant="outlined"
                color="error"
                startIcon={!isMobile && <DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                onClick={handleBulkDelete}
                aria-label={`Slett ${selectedIds.size} valgte crewmedlemmer`}
                sx={{
                  minHeight: TOUCH_TARGET_SIZE,
                  minWidth: { xs: TOUCH_TARGET_SIZE, sm: 'auto' },
                  borderColor: '#ff4444',
                  color: '#ff4444',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  ...focusVisibleStyles,
                }}
              >
                {isMobile ? <DeleteIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : `Slett (${selectedIds.size})`}
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Beregn kostnader (Ctrl+K)" arrow>
            <Button
              variant="outlined"
              startIcon={!isMobile && <CalculateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={() => setShowCostCalculator(!showCostCalculator)}
              aria-label="Vis kostnadsberegner"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: { xs: TOUCH_TARGET_SIZE, sm: 'auto' },
                borderColor: showCostCalculator ? '#00d4ff' : 'rgba(255,255,255,0.3)',
                color: showCostCalculator ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? <CalculateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : 'Kostnad'}
            </Button>
          </Tooltip>
          <Tooltip title="Eksporter til CSV (Ctrl+E)" arrow>
            <Button
              variant="outlined"
              startIcon={!isMobile && <DownloadIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={exportToCSV}
              aria-label="Eksporter crewliste til CSV"
              sx={{
                minHeight: TOUCH_TARGET_SIZE,
                minWidth: { xs: TOUCH_TARGET_SIZE, sm: 'auto' },
                borderColor: 'rgba(255,255,255,0.3)',
                color: 'rgba(255,255,255,0.87)',
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                ...focusVisibleStyles,
              }}
            >
              {isMobile ? <DownloadIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : 'Eksporter'}
            </Button>
          </Tooltip>
          <Tooltip title="Legg til nytt crewmedlem (Ctrl+N)" arrow>
            <Button
              variant="contained"
              startIcon={<AddIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
              onClick={() => handleOpenDialog()}
              aria-label="Legg til nytt crewmedlem"
              sx={{
                bgcolor: '#00d4ff',
                color: '#000',
                fontWeight: 600,
                minHeight: TOUCH_TARGET_SIZE,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                flex: { xs: 1, sm: 'none' },
                ...focusVisibleStyles,
                '&:hover': { bgcolor: '#00b8e6' },
              }}
            >
              {isMobile ? 'Ny' : 'Legg til'}
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Cost Calculator Panel - Responsive */}
      <Collapse in={showCostCalculator}>
        <Box
          sx={{
            mb: 3,
            p: { xs: 1.5, sm: 2 },
            bgcolor: 'rgba(0, 212, 255, 0.1)',
            borderRadius: 2,
            border: '1px solid rgba(0, 212, 255, 0.3)',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              color: '#00d4ff',
              fontWeight: 600,
              mb: 2,
              fontSize: { xs: '0.9rem', sm: '1rem' },
            }}
          >
            Kostnadsberegner {selectedIds.size > 0 && `(${selectedIds.size} valgte)`}
          </Typography>

          {/* Date inputs - stack on mobile */}
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 1, sm: 2 },
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              alignItems: { xs: 'stretch', sm: 'center' },
              mb: calculateCost ? 2 : 0,
            }}
          >
            <TextField
              type="date"
              label="Fra dato"
              value={costStartDate}
              onChange={(e) => setCostStartDate(e.target.value)}
              size="small"
              fullWidth={isMobile}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { 'aria-label': 'Startdato for kostnadsberegning' },
              }}
              sx={{
                flex: { xs: 1, sm: 'none' },
                minWidth: { sm: 150 },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <TextField
              type="date"
              label="Til dato"
              value={costEndDate}
              onChange={(e) => setCostEndDate(e.target.value)}
              size="small"
              fullWidth={isMobile}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { 'aria-label': 'Sluttdato for kostnadsberegning' },
              }}
              sx={{
                flex: { xs: 1, sm: 'none' },
                minWidth: { sm: 150 },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: TOUCH_TARGET_SIZE,
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
          </Box>

          {/* Cost results - responsive grid */}
          {calculateCost && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: { xs: 1.5, sm: 2 },
                pt: 2,
                borderTop: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                  Antall dager
                </Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                  {calculateCost.days}
                </Typography>
              </Box>
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                  Team
                </Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                  {calculateCost.crewCount}
                </Typography>
              </Box>
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                  Fast honorar totalt
                </Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  {calculateCost.dailyRate.toLocaleString('nb-NO')} kr
                </Typography>
              </Box>
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, gridColumn: { xs: 'span 2', sm: 'auto' } }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                  Totalkostnad
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    color: '#4caf50',
                    fontWeight: 700,
                    fontSize: { xs: '1.25rem', sm: '1.5rem' },
                  }}
                >
                  {calculateCost.total.toLocaleString('nb-NO')} kr
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Statistics panel - Responsive grid */}
      {crewMembers.length > 0 && (
        <Collapse in={showStats}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(3, 1fr)',
                md: 'repeat(auto-fit, minmax(100px, 1fr))'
              },
              gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
              mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
              bgcolor: 'rgba(0,212,255,0.05)',
              borderRadius: 2,
              border: '1px solid rgba(0,212,255,0.2)',
            }}
            role="region"
            aria-label="Crew statistikk"
          >
            <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <GroupsIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#00d4ff' }} />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  color: '#00d4ff',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' },
                }}
              >
                {stats.total}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                Totalt
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#4caf50' }} />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  color: '#4caf50',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' },
                }}
              >
                {stats.availableNow}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                Tilgjengelig
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', gridColumn: { xs: 'span 2', sm: 'auto' }, p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                <CalculateIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 }, color: '#ff9800' }} />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  color: '#ff9800',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', sm: '2rem', md: '1.6rem', lg: '1.85rem', xl: '2.5rem' },
                }}
              >
                {stats.totalDailyRate.toLocaleString('no-NO')} kr
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                Total fast honorar
              </Typography>
            </Box>
            {Object.entries(stats.roleCount).slice(0, isMobile ? 2 : 4).map(([role, count]) => (
              <Box key={role} sx={{ textAlign: 'center', p: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
                  <GroupsIcon sx={{ fontSize: { xs: 14, sm: 16, md: 15, lg: 17, xl: 20 }, color: '#fff', opacity: 0.7 }} />
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.375rem', lg: '1.625rem', xl: '2rem' },
                  }}
                >
                  {count}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                  }}
                >
                  {getRoleLabel(role as CrewRole)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      )}

      {/* Search, filter, and view controls - Responsive */}
      {crewMembers.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {/* Search bar and controls - stack on mobile */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 1, sm: 2 },
              mb: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            {/* Search field - full width on mobile */}
            <TextField
              placeholder={isMobile ? "Søk..." : "Søk etter navn, e-post, telefon..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                    </InputAdornment>
                  ),
                  'aria-label': 'Søk i crewmedlemmer',
                },
              }}
              sx={{
                flex: { sm: 1 },
                minWidth: { sm: 200, md: 180, lg: 220, xl: 260 },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  minHeight: TOUCH_TARGET_SIZE,
                  fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                  height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                },
              }}
            />

            {/* Controls row - always horizontal */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
              <Tooltip title="Vis/skjul filtre" arrow>
                <IconButton
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label="Vis eller skjul filtre"
                  aria-expanded={showFilters}
                  sx={{
                    color: showFilters ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    bgcolor: showFilters ? 'rgba(0,212,255,0.1)' : 'transparent',
                    ...focusVisibleStyles,
                  }}
                >
                  <FilterListIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Vis/skjul statistikk" arrow>
                <IconButton
                  onClick={() => setShowStats(!showStats)}
                  aria-label="Vis eller skjul statistikk"
                  aria-expanded={showStats}
                  sx={{
                    color: showStats ? '#00d4ff' : 'rgba(255,255,255,0.7)',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    ...focusVisibleStyles,
                  }}
                >
                  {showStats ? <ExpandLessIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <ExpandMoreIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                </IconButton>
              </Tooltip>

              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                aria-label="Velg visningsmodus"
                size="small"
              >
                <ToggleButton
                  value="grid"
                  aria-label="Kortvisning"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    '&.Mui-selected': { color: '#00d4ff', bgcolor: 'rgba(0,212,255,0.1)' },
                    ...focusVisibleStyles,
                  }}
                >
                  <ViewModuleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                </ToggleButton>
                <ToggleButton
                  value="table"
                  aria-label="Tabellvisning"
                  sx={{
                    color: 'rgba(255,255,255,0.87)',
                    minWidth: TOUCH_TARGET_SIZE,
                    minHeight: TOUCH_TARGET_SIZE,
                    '&.Mui-selected': { color: '#00d4ff', bgcolor: 'rgba(0,212,255,0.1)' },
                    ...focusVisibleStyles,
                  }}
                >
                  <ViewListIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Filter panel */}
          {/* Filter panel - Responsive */}
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
                flexWrap: 'wrap',
                alignItems: { xs: 'stretch', sm: 'center' },
              }}
              role="group"
              aria-label="Filteralternativer"
            >
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150, md: 135, lg: 150, xl: 180 }, flex: { xs: 1, sm: 'none' } }}>
                <InputLabel
                  sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}
                  id="filter-role-label"
                >
                  Filtrer på rolle
                </InputLabel>
                <Select
                  labelId="filter-role-label"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as CrewRole | 'all')}
                  label="Filtrer på rolle"
                  sx={{
                    color: '#fff',
                    minHeight: TOUCH_TARGET_SIZE,
                    fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    height: { xs: 36, sm: 40, md: 42, lg: 48, xl: 60 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  }}
                >
                  <MenuItem value="all" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <PeopleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                      <span>Alle roller</span>
                    </Box>
                  </MenuItem>
                  {crewRoles.map((role) => (
                    <MenuItem key={role} value={role} sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      {getRoleLabel(role)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant={filterAvailable ? 'contained' : 'outlined'}
                  onClick={() => setFilterAvailable(!filterAvailable)}
                  startIcon={<CheckCircleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                  aria-pressed={filterAvailable}
                  sx={{
                    minHeight: TOUCH_TARGET_SIZE,
                    flex: { xs: 1, sm: 'none' },
                    color: filterAvailable ? '#000' : 'rgba(255,255,255,0.7)',
                    bgcolor: filterAvailable ? '#4caf50' : 'transparent',
                    borderColor: 'rgba(255,255,255,0.2)',
                    fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    px: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                    py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                    ...focusVisibleStyles,
                    '&:hover': {
                      bgcolor: filterAvailable ? '#43a047' : 'rgba(255,255,255,0.05)',
                    },
                  }}
                >
                  {isMobile ? 'Tilgjengelig' : 'Kun tilgjengelige'}
                </Button>

                {(filterRole !== 'all' || filterAvailable || searchQuery) && (
                  <Button
                    variant="text"
                    onClick={() => {
                      setFilterRole('all');
                      setFilterAvailable(false);
                      setSearchQuery('');
                    }}
                    sx={{
                      color: '#ff9800',
                      minHeight: TOUCH_TARGET_SIZE,
                      flex: { xs: 1, sm: 'none' },
                      ...focusVisibleStyles,
                    }}
                  >
                    Nullstill
                  </Button>
                )}
              </Box>
            </Box>
          </Collapse>

          {/* Results count - Responsive */}
          {(searchQuery || filterRole !== 'all' || filterAvailable) && (
            <Alert
              severity="info"
              sx={{
                mb: 2,
                bgcolor: 'rgba(0,212,255,0.1)',
                color: '#fff',
                py: { xs: 0.5, sm: 1 },
                '& .MuiAlert-icon': { color: '#00d4ff' },
                '& .MuiAlert-message': { fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' } },
              }}
            >
              Viser {filteredAndSortedCrew.length} av {crewMembers.length} teammedlemmer
            </Alert>
          )}
        </Box>
      )}

      {/* Empty state */}
      {crewMembers.length === 0 ? (
        <Box
          role="status"
          aria-label="Ingen crewmedlemmer"
          sx={{
            textAlign: 'center',
            py: 8,
            color: 'rgba(255,255,255,0.87)',
          }}
        >
          <PersonIcon sx={{ fontSize: { xs: 60, sm: 70, md: 65, lg: 80, xl: 104 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, opacity: 0.3 }} aria-hidden="true" />
          <Typography variant="body1" sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }}>Ingen teammedlemmer ennå</Typography>
          <Typography variant="body2" sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
            Legg til teammedlemmer for å organisere produksjonsteamet
          </Typography>
        </Box>
      ) : filteredAndSortedCrew.length === 0 ? (
        <Box
          role="status"
          sx={{ textAlign: 'center', py: 6, color: 'rgba(255,255,255,0.87)' }}
        >
          <SearchIcon sx={{ fontSize: { xs: 48, sm: 56, md: 52, lg: 64, xl: 80 }, mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, opacity: 0.3 }} />
          <Typography variant="body1" sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' } }}>Ingen treff på søket</Typography>
          <Typography variant="body2" sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
            Prøv å endre søkeord eller filtre
          </Typography>
        </Box>
      ) : viewMode === 'table' ? (
        /* Table View - Responsive with horizontal scroll */
        <TableContainer
          component={Paper}
          sx={{
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            // Scroll indicator shadow
            '&::-webkit-scrollbar': { height: 8 },
            '&::-webkit-scrollbar-track': { bgcolor: 'rgba(255,255,255,0.05)' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,212,255,0.3)', borderRadius: 4 },
          }}
        >
          <Table
            aria-label="Crewmedlemmer tabell"
            sx={{ minWidth: { xs: 600, sm: 700, md: 750, lg: 850, xl: 1100 } }}
          >
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                <TableCell padding="checkbox" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <Checkbox
                    checked={selectedIds.size === filteredAndSortedCrew.length && filteredAndSortedCrew.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedCrew.length}
                    onChange={handleSelectAll}
                    aria-label="Velg alle crewmedlemmer"
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      '&.Mui-checked': { color: '#00d4ff' },
                    }}
                  />
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'name'}
                    direction={sortField === 'name' ? sortDirection : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#00d4ff' } }}
                  >
                    Navn
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'role'}
                    direction={sortField === 'role' ? sortDirection : 'asc'}
                    onClick={() => handleSort('role')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#00d4ff' } }}
                  >
                    Rolle
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Kontakt</TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'rate'}
                    direction={sortField === 'rate' ? sortDirection : 'asc'}
                    onClick={() => handleSort('rate')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#00d4ff' } }}
                  >
                    Fast honorar
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                  <TableSortLabel
                    active={sortField === 'availability'}
                    direction={sortField === 'availability' ? sortDirection : 'asc'}
                    onClick={() => handleSort('availability')}
                    sx={{ color: '#fff', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, '&:hover': { color: '#00d4ff' } }}
                  >
                    Tilgjengelighet
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedCrew.map((member) => (
                <TableRow
                  key={member.id}
                  hover
                  selected={selectedIds.has(member.id)}
                  sx={{
                    '&:hover': { bgcolor: 'rgba(0,212,255,0.05)' },
                    '&.Mui-selected': { bgcolor: 'rgba(0,212,255,0.1)' },
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(member.id)}
                      onChange={() => handleSelectOne(member.id)}
                      aria-label={`Velg ${member.name}`}
                      sx={{
                        color: 'rgba(255,255,255,0.87)',
                        '&.Mui-checked': { color: '#00d4ff' },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                      <Avatar
                        sx={{
                          width: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 },
                          height: { xs: 32, sm: 36, md: 34, lg: 40, xl: 48 },
                          bgcolor: getAvatarColor(member.role),
                          fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                          fontWeight: 600,
                        }}
                        aria-hidden="true"
                      >
                        {getInitials(member.name)}
                      </Avatar>
                      <Box>
                        <Typography sx={{ color: '#fff', fontWeight: 500, lineHeight: 1.2, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                          {member.name}
                        </Typography>
                        {favorites.has(member.id) && (
                          <StarIcon sx={{ fontSize: { xs: 12, sm: 14, md: 13, lg: 15, xl: 18 }, color: '#ffc107', ml: 0.5, verticalAlign: 'middle' }} />
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Chip
                      label={getRoleLabel(member.role)}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(0,212,255,0.2)',
                        color: '#00d4ff',
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                        height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      {member.contactInfo?.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                          <Typography
                            variant="body2"
                            component="a"
                            href={`mailto:${member.contactInfo.email}`}
                            sx={{ color: 'rgba(255,255,255,0.87)', textDecoration: 'none', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}
                          >
                            {member.contactInfo.email}
                          </Typography>
                          <Tooltip title={copiedField === `email-${member.id}` ? 'Kopiert!' : 'Kopier'}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(member.contactInfo.email!, `email-${member.id}`)}
                              sx={{ color: copiedField === `email-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.5)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                            >
                              {copiedField === `email-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} /> : <CopyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                      {member.contactInfo?.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                          <Typography
                            variant="body2"
                            component="a"
                            href={`tel:${member.contactInfo.phone}`}
                            sx={{ color: 'rgba(255,255,255,0.87)', textDecoration: 'none', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}
                          >
                            {member.contactInfo.phone}
                          </Typography>
                          <Tooltip title={copiedField === `phone-${member.id}` ? 'Kopiert!' : 'Kopier'}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(member.contactInfo.phone!, `phone-${member.id}`)}
                              sx={{ color: copiedField === `phone-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.5)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                            >
                              {copiedField === `phone-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} /> : <CopyIcon sx={{ fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.87)', py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                    {member.rate ? `${member.rate.toLocaleString('no-NO')} kr` : '-'}
                  </TableCell>
                  <TableCell sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    {member.availability?.startDate && member.availability?.endDate ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                        <Box
                          sx={{
                            width: { xs: 8, sm: 9, md: 8.5, lg: 10, xl: 12 },
                            height: { xs: 8, sm: 9, md: 8.5, lg: 10, xl: 12 },
                            borderRadius: '50%',
                            bgcolor: isAvailableNow(member) ? '#4caf50' : '#ff9800',
                          }}
                        />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                          {member.availability.startDate} - {member.availability.endDate}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)', fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' } }}>
                        Ikke satt
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ py: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                      <Tooltip title={favorites.has(member.id) ? 'Fjern favoritt' : 'Legg til favoritt'}>
                        <IconButton
                          onClick={() => toggleFavorite(member.id)}
                          aria-label={favorites.has(member.id) ? `Fjern ${member.name} fra favoritter` : `Legg til ${member.name} som favoritt`}
                          sx={{ color: favorites.has(member.id) ? '#ffc107' : 'rgba(255,255,255,0.3)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          {favorites.has(member.id) ? <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dupliser">
                        <IconButton
                          onClick={() => handleDuplicate(member)}
                          aria-label={`Dupliser ${member.name}`}
                          sx={{ color: 'rgba(255,255,255,0.87)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          <DuplicateIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rediger">
                        <IconButton
                          onClick={() => handleOpenDialog(member)}
                          aria-label={`Rediger ${member.name}`}
                          sx={{ color: '#00d4ff', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett">
                        <IconButton
                          onClick={() => handleDeleteWithUndo(member.id)}
                          aria-label={`Slett ${member.name}`}
                          sx={{ color: '#ff4444', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE, ...focusVisibleStyles }}
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
      ) : (
        /* Grid View - Enhanced cards matching ProductionDayView */
        <Grid
          container
          spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 3 }}
          role="list"
          aria-label={`Liste over ${filteredAndSortedCrew.length} crewmedlemmer`}
        >
          {filteredAndSortedCrew.map((member) => (
            <Grid
              size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
              key={member.id}
              role="listitem"
            >
              <Card
                component="article"
                aria-labelledby={`crew-name-${member.id}`}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: selectedIds.has(member.id) ? 'rgba(77,208,225,0.15)' : 'rgba(255,255,255,0.05)',
                  border: selectedIds.has(member.id) ? '2px solid #4dd0e1' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  ...focusVisibleStyles,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                    borderColor: '#4dd0e1',
                    boxShadow: '0 8px 24px rgba(77,208,225,0.2)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Header with gradient box */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        onChange={() => handleSelectOne(member.id)}
                        aria-label={`Velg ${member.name}`}
                        sx={{ p: 0.5, color: 'rgba(255,255,255,0.6)', '&.Mui-checked': { color: '#4dd0e1' } }}
                      />
                      <Box sx={{ flex: 1 }}>
                        {/* Eye-catching Member Header */}
                        <Box
                          sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2.5,
                            background: 'linear-gradient(135deg, rgba(77,208,225,0.25) 0%, rgba(0,188,212,0.15) 100%)',
                            border: '2px solid rgba(77,208,225,0.4)',
                            boxShadow: '0 4px 12px rgba(77,208,225,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '3px',
                              background: 'linear-gradient(90deg, #4dd0e1 0%, #00bcd4 50%, #4dd0e1 100%)',
                            },
                          }}
                        >
                          {/* Avatar with gradient */}
                          <Avatar
                            sx={{
                              width: { xs: 50, sm: 60, md: 55, lg: 70, xl: 80 },
                              height: { xs: 50, sm: 60, md: 55, lg: 70, xl: 80 },
                              background: `linear-gradient(135deg, ${getAvatarColor(member.role)} 0%, ${getAvatarColor(member.role)}dd 100%)`,
                              fontSize: { xs: '1rem', sm: '1.25rem', md: '1.125rem', lg: '1.375rem', xl: '1.5rem' },
                              fontWeight: 700,
                              border: '2px solid rgba(255,255,255,0.3)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            }}
                            aria-hidden="true"
                          >
                            {getInitials(member.name)}
                          </Avatar>

                          {/* Name and role */}
                          <Box sx={{ flex: 1, zIndex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 } }}>
                              <Typography
                                variant="h6"
                                component="h3"
                                id={`crew-name-${member.id}`}
                                sx={{
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: { xs: '1rem', sm: '1.125rem', md: '1.0625rem', lg: '1.1875rem', xl: '1.25rem' },
                                  lineHeight: 1.2,
                                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }}
                              >
                                {member.name}
                              </Typography>
                              {favorites.has(member.id) && (
                                <StarIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 }, color: '#ffc107' }} aria-label="Favoritt" />
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 }, mt: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                              <Chip
                                label={getRoleLabel(member.role)}
                                size="small"
                                sx={{
                                  bgcolor: 'rgba(77,208,225,0.3)',
                                  color: '#4dd0e1',
                                  fontWeight: 700,
                                  height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                  fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                  border: '1px solid rgba(77,208,225,0.5)',
                                }}
                              />
                              {isAvailableNow(member) && (
                                <Chip
                                  label="Tilgjengelig"
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(76,175,80,0.3)',
                                    color: '#81c784',
                                    fontWeight: 600,
                                    height: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.72rem', lg: '0.8rem', xl: '0.9rem' },
                                    border: '1px solid rgba(76,175,80,0.5)',
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                    <IconButton
                      onClick={() => toggleFavorite(member.id)}
                      aria-label={favorites.has(member.id) ? `Fjern ${member.name} fra favoritter` : `Legg til ${member.name} som favoritt`}
                      sx={{
                        color: favorites.has(member.id) ? '#ffc107' : 'rgba(255,255,255,0.3)',
                        minWidth: TOUCH_TARGET_SIZE,
                        minHeight: TOUCH_TARGET_SIZE,
                        ...focusVisibleStyles,
                      }}
                    >
                      {favorites.has(member.id) ? <StarIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} /> : <StarBorderIcon sx={{ fontSize: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 } }} />}
                    </IconButton>
                  </Box>

                  {/* Contact Info Cards - Enhanced */}
                  <Stack spacing={{ xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 } }}>
                    {member.contactInfo?.email && (
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
                            width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(77,208,225,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <EmailIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#4dd0e1' }} />
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
                            component="a"
                            href={`mailto:${member.contactInfo.email}`}
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.85rem', sm: '0.95rem', md: '0.9rem', lg: '1rem', xl: '1.125rem' },
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                              textDecoration: 'none',
                              '&:hover': { color: '#4dd0e1' },
                            }}
                          >
                            {member.contactInfo.email}
                          </Typography>
                        </Box>
                        <Tooltip title={copiedField === `grid-email-${member.id}` ? 'Kopiert!' : 'Kopier'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(member.contactInfo.email!, `grid-email-${member.id}`)}
                            sx={{ color: copiedField === `grid-email-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.4)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                          >
                            {copiedField === `grid-email-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CopyIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}

                    {member.contactInfo?.phone && (
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
                            component="a"
                            href={`tel:${member.contactInfo.phone}`}
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.025rem', lg: '1.15rem', xl: '1.25rem' },
                              fontWeight: 700,
                              display: 'block',
                              textDecoration: 'none',
                              '&:hover': { color: '#a78bfa' },
                            }}
                          >
                            {member.contactInfo.phone}
                          </Typography>
                        </Box>
                        <Tooltip title={copiedField === `grid-phone-${member.id}` ? 'Kopiert!' : 'Kopier'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(member.contactInfo.phone!, `grid-phone-${member.id}`)}
                            sx={{ color: copiedField === `grid-phone-${member.id}` ? '#4caf50' : 'rgba(255,255,255,0.4)', minWidth: TOUCH_TARGET_SIZE, minHeight: TOUCH_TARGET_SIZE }}
                          >
                            {copiedField === `grid-phone-${member.id}` ? <CheckCircleIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <CopyIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}

                    {/* Rate Card */}
                    {member.rate && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                          borderRadius: 2,
                          bgcolor: 'rgba(76,175,80,0.1)',
                          border: '1px solid rgba(76,175,80,0.25)',
                        }}
                      >
                        <Box
                          sx={{
                            width: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            height: { xs: 40, sm: 48, md: 44, lg: 52, xl: 60 },
                            borderRadius: 1.5,
                            bgcolor: 'rgba(76,175,80,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography sx={{ fontSize: { xs: 18, sm: 22, md: 20, lg: 24, xl: 28 }, fontWeight: 700, color: '#81c784' }}>kr</Typography>
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
                            Fast honorar
                          </Typography>
                          <Typography
                            sx={{
                              color: '#fff',
                              fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.025rem', lg: '1.15rem', xl: '1.25rem' },
                              fontWeight: 700,
                            }}
                          >
                            {member.rate.toLocaleString('nb-NO')} kr
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Stack>

                  {/* Expandable details */}
                  <Collapse in={expandedCards.has(member.id)}>
                    <Box sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
                      {member.contactInfo?.address && (
                        <Box
                          sx={{
                            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(77,208,225,0.08)',
                            border: '1px solid rgba(77,208,225,0.2)',
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#4dd0e1',
                              fontWeight: 700,
                              mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Adresse
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                            {member.contactInfo.address}
                          </Typography>
                        </Box>
                      )}
                      {member.notes && (
                        <Box
                          sx={{
                            mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                            p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                            borderRadius: 2,
                            bgcolor: 'rgba(139,92,246,0.08)',
                            border: '1px solid rgba(139,92,246,0.2)',
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#a78bfa',
                              fontWeight: 700,
                              mb: { xs: 0.5, sm: 0.75, md: 0.625, lg: 0.75, xl: 1 },
                              fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Notater
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                            {member.notes}
                          </Typography>
                        </Box>
                      )}
                      {member.assignedScenes && member.assignedScenes.length > 0 && (
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
                              bgcolor: 'rgba(77,208,225,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <MovieIcon sx={{ fontSize: { xs: 22, sm: 26, md: 24, lg: 28, xl: 32 }, color: '#4dd0e1' }} />
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
                              Tildelte scener
                            </Typography>
                            <Typography
                              sx={{
                                color: '#fff',
                                fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.025rem', lg: '1.15rem', xl: '1.25rem' },
                                fontWeight: 700,
                              }}
                            >
                              {member.assignedScenes.length} scene{member.assignedScenes.length !== 1 ? 'r' : ''}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Collapse>

                  {/* Availability - compact */}
                  {member.availability?.startDate && member.availability?.endDate && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255,255,255,0.87)',
                        display: 'block',
                        mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 },
                        fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                      }}
                    >
                      📅 {member.availability.startDate} - {member.availability.endDate}
                    </Typography>
                  )}

                  {/* Card Actions - Enhanced */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      pt: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                      mt: 'auto',
                      borderTop: '2px solid rgba(77,208,225,0.2)',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="medium"
                      onClick={() => toggleExpanded(member.id)}
                      endIcon={expandedCards.has(member.id) ? <ExpandLessIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} /> : <ExpandMoreIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
                      aria-expanded={expandedCards.has(member.id)}
                      aria-label={expandedCards.has(member.id) ? 'Skjul detaljer' : 'Vis mer'}
                      sx={{
                        bgcolor: expandedCards.has(member.id)
                          ? 'rgba(77,208,225,0.25)'
                          : 'rgba(77,208,225,0.15)',
                        color: expandedCards.has(member.id) ? '#4dd0e1' : '#fff',
                        fontSize: { xs: '0.8rem', sm: '0.875rem', md: '0.85rem', lg: '0.88rem', xl: '1rem' },
                        fontWeight: 600,
                        minHeight: TOUCH_TARGET_SIZE,
                        px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
                        py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                        border: expandedCards.has(member.id)
                          ? '2px solid rgba(77,208,225,0.5)'
                          : '2px solid rgba(77,208,225,0.3)',
                        borderRadius: 2,
                        textTransform: 'none',
                        boxShadow: expandedCards.has(member.id)
                          ? '0 4px 12px rgba(77,208,225,0.3)'
                          : '0 2px 8px rgba(77,208,225,0.2)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(77,208,225,0.35)',
                          borderColor: 'rgba(77,208,225,0.6)',
                          transform: 'translateY(-1px)',
                          boxShadow: '0 6px 16px rgba(77,208,225,0.4)',
                        },
                        ...focusVisibleStyles,
                      }}
                    >
                      {expandedCards.has(member.id) ? 'Skjul detaljer' : 'Vis detaljer'}
                    </Button>
                    <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1, md: 0.75, lg: 1, xl: 1.25 } }}>
                      <Tooltip title="Dupliser" arrow>
                        <IconButton
                          onClick={() => handleDuplicate(member)}
                          aria-label={`Dupliser ${member.name}`}
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
                          onClick={() => handleOpenDialog(member)}
                          aria-label={`Rediger ${member.name}`}
                          sx={{
                            minWidth: TOUCH_TARGET_SIZE,
                            minHeight: TOUCH_TARGET_SIZE,
                            color: '#4dd0e1',
                            '&:hover': { bgcolor: 'rgba(77,208,225,0.1)' },
                            ...focusVisibleStyles,
                          }}
                        >
                          <EditIcon sx={{ fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Slett" arrow>
                        <IconButton
                          onClick={() => handleDeleteWithUndo(member.id)}
                          aria-label={`Slett ${member.name}`}
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
          ))}
        </Grid>
      )}

      {/* Undo delete snackbar */}
      <Snackbar
        open={showUndoSnackbar}
        autoHideDuration={6000}
        onClose={() => {
          setShowUndoSnackbar(false);
          setDeletedCrew(null);
        }}
        message={deletedCrew ? `"${deletedCrew.name}" slettet` : 'Teammedlem slettet'}
        action={
          <>
            <Button
              color="primary"
              size="small"
              onClick={handleUndoDelete}
              startIcon={<UndoIcon />}
              sx={{ color: '#00d4ff', fontWeight: 600 }}
            >
              Angre
            </Button>
            <IconButton
              size="small"
              aria-label="Lukk"
              color="inherit"
              onClick={() => {
                setShowUndoSnackbar(false);
                setDeletedCrew(null);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{
          '& .MuiSnackbarContent-root': {
            bgcolor: '#1c2128',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      />

      {/* Edit/Create Dialog - WCAG 2.2 compliant and responsive */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile} // Full screen on mobile for better UX
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
              // iPad-friendly: ensure dialog doesn't go off-screen
              maxHeight: { xs: '100%', sm: '90vh' },
              m: { xs: 0, sm: 2, md: 2.5, lg: 3, xl: 4 },
              borderRadius: { xs: 0, sm: 2 },
              maxWidth: { xs: '95vw', sm: '90vw', md: '85vw', lg: '80vw', xl: '75vw' },
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
            fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.2rem', lg: '1.375rem', xl: '1.75rem' },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
            px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            gap: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
          }}
        >
          {editingCrewMember ? 'Rediger teammedlem' : 'Nytt teammedlem'}
          {/* Close button for mobile */}
          {isMobile && (
            <IconButton
              onClick={handleCloseDialog}
              aria-label="Lukk dialog"
              sx={{ color: 'rgba(255,255,255,0.87)', mr: -1 }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent
          sx={{
            pt: { xs: 2, sm: 3, md: 2.75, lg: 3, xl: 3.5 },
            px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            pb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            // Better scroll behavior for iPad
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Typography
            id={dialogDescId}
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.87)', mb: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}
          >
            Fyll ut informasjon om teammedlemmet. Felter merket med * er påkrevd.
          </Typography>
          <Stack spacing={{ xs: 2.5, sm: 3, md: 2.75, lg: 3, xl: 3.5 }} sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
            <TextField
              label="Navn *"
              fullWidth
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoComplete="name"
              slotProps={{
                htmlInput: {
                  'aria-required': true,
                  'aria-label': 'Navn på crewmedlem (påkrevd)',
                },
              }}
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
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />

            <FormControl fullWidth>
              <InputLabel
                id="crew-role-label"
                sx={{
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '&.Mui-focused': { color: '#00d4ff' },
                }}
              >
                Rolle
              </InputLabel>
              <Select
                labelId="crew-role-label"
                value={formData.role || 'other'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as CrewRole })}
                label="Rolle"
                inputProps={{ 'aria-label': 'Velg rolle for crewmedlem' }}
                MenuProps={{
                  sx: { zIndex: 100001 },
                  slotProps: {
                    paper: {
                      sx: {
                        bgcolor: '#1c2128',
                        color: '#fff',
                        maxHeight: 300,
                        '& .MuiMenuItem-root': {
                          '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
                          '&.Mui-selected': { bgcolor: 'rgba(0,212,255,0.2)' },
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
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& .MuiSelect-select': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                }}
              >
                {crewRoles.map((role) => (
                  <MenuItem
                    key={role}
                    value={role}
                    sx={{
                      minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      '&:focus-visible': { bgcolor: 'rgba(0,212,255,0.2)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 } }}>
                      {getRoleIcon(role)}
                      <span>{getRoleLabel(role)}</span>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="E-post"
              fullWidth
              type="email"
              inputMode="email"
              autoComplete="email"
              value={formData.contactInfo?.email || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contactInfo: { ...formData.contactInfo, email: e.target.value },
                })
              }
              slotProps={{ htmlInput: { 'aria-label': 'E-postadresse' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CustomEmailIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />

            <TextField
              label="Telefon"
              fullWidth
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={formData.contactInfo?.phone || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contactInfo: { ...formData.contactInfo, phone: e.target.value },
                })
              }
              slotProps={{ htmlInput: { 'aria-label': 'Telefonnummer' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CustomPhoneIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />

            <TextField
              label="Adresse"
              fullWidth
              autoComplete="street-address"
              value={formData.contactInfo?.address || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  contactInfo: { ...formData.contactInfo, address: e.target.value },
                })
              }
              slotProps={{ htmlInput: { 'aria-label': 'Adresse' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AddressIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />

            <TextField
              label="Fast honorar (kr)"
              fullWidth
              type="number"
              value={formData.rate || ''}
              onChange={(e) => setFormData({ ...formData, rate: parseInt(e.target.value) || undefined })}
              slotProps={{ htmlInput: { 'aria-label': 'Fast honorar i kroner', min: 0 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <RateIcon sx={{ color: 'rgba(255,255,255,0.87)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />

            {/* Split Sheet Section - synced with NewProjectCreationModal */}
            <Box sx={{ mt: { xs: 1, sm: 1.25, md: 1.125, lg: 1.25, xl: 1.5 } }}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: '#f59e0b',
                  fontWeight: 600,
                  mb: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                }}
              >
                <SplitSheetIcon sx={{ color: '#f59e0b', fontSize: { xs: 16, sm: 18, md: 17, lg: 19, xl: 20 } }} />
                Split Sheet
              </Typography>
              
              <Stack spacing={{ xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 }}>
                {/* Total Budget Input - only show if not provided via props */}
                {totalBudget === 0 && (
                  <TextField
                    label="Totalt budsjett (kr)"
                    fullWidth
                    type="number"
                    value={localBudget || ''}
                    onChange={(e) => {
                      const newBudget = parseFloat(e.target.value) || 0;
                      setLocalBudget(newBudget);
                      onTotalBudgetChange?.(newBudget);
                    }}
                    slotProps={{ 
                      htmlInput: { 
                        'aria-label': 'Totalt prosjektbudsjett i kroner', 
                        min: 0 
                      } 
                    }}
                    helperText="Sett totalt budsjett for å beregne prosentandel automatisk fra fast honorar"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#fff',
                        minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                        '& fieldset': { borderColor: 'rgba(245,158,11,0.5)' },
                        '&:hover fieldset': { borderColor: 'rgba(245,158,11,0.7)' },
                        '&.Mui-focused fieldset': { borderColor: '#f59e0b', borderWidth: 2 },
                        '& input': {
                          py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                        },
                      },
                      '& .MuiInputLabel-root': { 
                        color: '#f59e0b',
                        fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      },
                      '& .MuiInputLabel-root.Mui-focused': { color: '#f59e0b' },
                      '& .MuiFormHelperText-root': { 
                        color: 'rgba(255,255,255,0.87)',
                        fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                      },
                    }}
                  />
                )}

                {/* Calculated percentage display */}
                {effectiveBudget > 0 && formData.rate && formData.rate > 0 && (
                  <Alert 
                    severity="info" 
                    sx={{ 
                      bgcolor: 'rgba(245,158,11,0.1)', 
                      color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.3)',
                      p: { xs: 1.5, sm: 2, md: 1.75, lg: 2, xl: 2.5 },
                      '& .MuiAlert-icon': { color: '#f59e0b', fontSize: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 } },
                      '& .MuiAlert-message': { fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' } }}>
                      <strong>Beregnet andel:</strong> {calculatedPercentage.toFixed(2)}% av budsjettet
                      <br />
                      <span style={{ fontSize: '0.85em', opacity: 0.8 }}>
                        ({formData.rate?.toLocaleString('no-NO')} kr / {effectiveBudget.toLocaleString('no-NO')} kr)
                      </span>
                    </Typography>
                  </Alert>
                )}

                <TextField
                  label="Prosentandel (%)"
                  fullWidth
                  type="number"
                  value={formData.splitSheet?.percentage?.toFixed(2) ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    splitSheet: { 
                      ...formData.splitSheet, 
                      percentage: parseFloat(e.target.value) || 0 
                    }
                  })}
                  slotProps={{ 
                    htmlInput: { 
                      'aria-label': 'Prosentandel av inntekt', 
                      min: 0, 
                      max: 100, 
                      step: 0.01,
                      readOnly: effectiveBudget > 0 && formData.rate ? true : false
                    } 
                  }}
                  helperText={
                    effectiveBudget > 0 && formData.rate 
                      ? "Beregnes automatisk fra fast honorar og budsjett" 
                      : "Andel av inntekt i prosent (0-100)"
                  }
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                      '& input': {
                        py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      },
                      ...(effectiveBudget > 0 && formData.rate && {
                        bgcolor: 'rgba(245,158,11,0.1)',
                        '& fieldset': { borderColor: 'rgba(245,158,11,0.3)' },
                      }),
                    },
                    '& .MuiInputLabel-root': { 
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
                    '& .MuiFormHelperText-root': { 
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.75rem', sm: '0.8125rem', md: '0.78125rem', lg: '0.875rem', xl: '1rem' },
                    },
                  }}
                />

                <FormControl fullWidth>
                  <InputLabel
                    id="invitation-status-label"
                    sx={{
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      '&.Mui-focused': { color: '#00d4ff' },
                    }}
                  >
                    Invitasjonsstatus
                  </InputLabel>
                  <Select
                    labelId="invitation-status-label"
                    value={formData.splitSheet?.invitationStatus || 'not_sent'}
                    onChange={(e) => setFormData({
                      ...formData,
                      splitSheet: { 
                        ...formData.splitSheet, 
                        percentage: formData.splitSheet?.percentage ?? 0,
                        invitationStatus: e.target.value as 'not_sent' | 'sent' | 'viewed' | 'signed' | 'declined'
                      }
                    })}
                    label="Invitasjonsstatus"
                    inputProps={{ 'aria-label': 'Velg invitasjonsstatus' }}
                    MenuProps={{
                      sx: { zIndex: 100001 },
                      slotProps: {
                        paper: {
                          sx: {
                            bgcolor: '#1c2128',
                            color: '#fff',
                            '& .MuiMenuItem-root': {
                              '&:hover': { bgcolor: 'rgba(0,212,255,0.1)' },
                              '&.Mui-selected': { bgcolor: 'rgba(0,212,255,0.2)' },
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
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00d4ff', borderWidth: 2 },
                      '& .MuiSelect-select': {
                        py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      },
                    }}
                  >
                    <MenuItem value="not_sent" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      Ikke sendt
                    </MenuItem>
                    <MenuItem value="sent" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      Sendt
                    </MenuItem>
                    <MenuItem value="viewed" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      Sett
                    </MenuItem>
                    <MenuItem value="signed" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      Signert
                    </MenuItem>
                    <MenuItem value="declined" sx={{ minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 }, fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' }, py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 } }}>
                      Avslått
                    </MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Split Sheet-notater"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.splitSheet?.notes || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    splitSheet: { 
                      ...formData.splitSheet, 
                      percentage: formData.splitSheet?.percentage ?? 0,
                      notes: e.target.value 
                    }
                  })}
                  placeholder="F.eks. spesielle vilkår, PRO-tilknytning, IPI-nummer..."
                  slotProps={{ htmlInput: { 'aria-label': 'Split Sheet notater' } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#fff',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                      '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                      '& textarea': {
                        py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                      },
                    },
                    '& .MuiInputLabel-root': { 
                      color: 'rgba(255,255,255,0.87)',
                      fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                    },
                    '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
                  }}
                />
              </Stack>
            </Box>

            <TextField
              label="Tilgjengelig fra"
              fullWidth
              type="date"
              value={formData.availability?.startDate || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: { ...formData.availability, startDate: e.target.value },
                })
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { 'aria-label': 'Tilgjengelig fra dato' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />

            <TextField
              label="Tilgjengelig til"
              fullWidth
              type="date"
              value={formData.availability?.endDate || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: { ...formData.availability, endDate: e.target.value },
                })
              }
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { 'aria-label': 'Tilgjengelig til dato' },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  minHeight: { xs: 40, sm: 44, md: 48, lg: 52, xl: 60 },
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& input': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />

            <TextField
              label="Notater"
              fullWidth
              multiline
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              slotProps={{ htmlInput: { 'aria-label': 'Notater om crewmedlem' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#00d4ff', borderWidth: 2 },
                  '& textarea': {
                    py: { xs: 1, sm: 1.25, md: 1.375, lg: 1.5, xl: 1.75 },
                  },
                },
                '& .MuiInputLabel-root': { 
                  color: 'rgba(255,255,255,0.87)',
                  fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#00d4ff' },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            p: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
            gap: { xs: 1, sm: 1.5, md: 1.25, lg: 1.5, xl: 2 },
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: { xs: 'stretch', sm: 'flex-end' },
            // Sticky at bottom for mobile
            position: { xs: 'sticky', sm: 'relative' },
            bottom: 0,
            bgcolor: '#1c2128',
          }}
        >
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            aria-label="Avbryt og lukk dialog"
            fullWidth={isMobile}
            sx={{
              color: 'rgba(255,255,255,0.87)',
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 100, md: 110, lg: 120, xl: 140 },
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              ...focusVisibleStyles,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            startIcon={<SaveIcon sx={{ fontSize: { xs: 18, sm: 20, md: 19, lg: 21, xl: 24 } }} />}
            aria-label={editingCrewMember ? 'Lagre endringer' : 'Opprett nytt crewmedlem'}
            fullWidth={isMobile}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              fontWeight: 600,
              fontSize: { xs: '0.875rem', sm: '1rem', md: '0.95rem', lg: '1.05rem', xl: '1.125rem' },
              px: { xs: 2, sm: 2.5, md: 2.25, lg: 2.5, xl: 3 },
              py: { xs: 0.75, sm: 1, md: 0.875, lg: 1, xl: 1.25 },
              minHeight: TOUCH_TARGET_SIZE,
              minHeight: TOUCH_TARGET_SIZE,
              minWidth: { xs: 'auto', sm: 100 },
              ...focusVisibleStyles,
              '&:hover': { bgcolor: '#00b8e6' },
            }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
