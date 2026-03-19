/**
 * StripboardPanel.tsx  (refactored)
 * Visual shooting schedule with drag-and-drop scene organisation.
 *
 * All logic has been extracted into:
 *   stripboard.types.ts       – shared interfaces
 *   stripboard.constants.ts   – STRIP_COLORS, STATUS_CONFIG
 *   stripboard.mockData.ts    – demo data
 *   useScreenTier.ts          – 7-tier breakpoint hook
 *   useStripboardData.ts      – data loading + import/export/print
 *   useStripboardFilters.ts   – filter/sort/group state + memos
 *   useOptimizationSuggestions.ts – schedule analysis
 *   StripItem.tsx             – single strip card / compact row
 *   OptimizationPanel.tsx     – sidebar + dialog
 *   AssignStripDialog.tsx     – assign-to-day dialog
 *   PrintExportDialog.tsx     – print/export options dialog
 */

import { useState, useEffect, useMemo, useCallback, Fragment, type FC, type DragEvent, type MouseEvent } from 'react';
import {
  Box, Paper, Typography, Button, IconButton, Chip,
  Grid, Divider, Tooltip, Alert,
  Tabs, Tab, Menu, MenuItem,
  Collapse, LinearProgress, useTheme, alpha,
  Stack, Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  HelpOutline as HelpIcon,
  Event as EventIcon,
  Place as PlaceIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Celebration as CelebrationIcon,
  CalendarMonth as CalendarIcon,
  SwapVert as SwapVertIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Movie as MovieIcon,
  WbSunny as DayIcon,
  NightsStay as NightIcon,
  Home as IntIcon,
  Landscape as ExtIcon,
  Print as PrintIcon,
  ViewList as ListViewIcon,
  ViewModule as BoardViewIcon,
  MoreVert as MoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CompareArrows as CompareArrowsIcon,
  Speed as SpeedIcon,
  Groups as GroupsIcon,
  Category as CategoryIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  ZoomOutMap as ZoomOutMapIcon,
  ZoomInMap as ZoomInMapIcon,
  Autorenew as AutorenewIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon,
  Theaters as TheatersIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import {
  productionWorkflowService,
  type StripboardStrip,
} from '../../services/productionWorkflowService';

import type { ViewMode, GroupBy, StripsByDay, LocationGroup } from './stripboard.types';
import { STRIP_COLORS } from './stripboard.constants';
import { useScreenTier, getResponsiveValues } from './useScreenTier';
import { useStripboardData } from './useStripboardData';
import { useStripboardFilters } from './useStripboardFilters';
import { useOptimizationSuggestions } from './useOptimizationSuggestions';
import { StripItem, formatTime } from './StripItem';
import { OptimizationPanel, OptimizationDialog } from './OptimizationPanel';
import { AssignStripDialog } from './AssignStripDialog';
import { PrintExportDialog } from './PrintExportDialog';
import { StripboardGuide } from './StripboardGuide';

interface StripboardPanelProps {
  projectId: string;
  projectTitle?: string;
  onSceneSelect?: (sceneId: string) => void;
  onGenerateCallSheet?: (dayId: string) => void;
}

const StripboardPanel: FC<StripboardPanelProps> = ({
  projectId,
  projectTitle = 'TROLL',
  onSceneSelect,
  onGenerateCallSheet,
}) => {
  const theme = useTheme();
  const { tier, isMobile, isTablet, isDesktop, is4K } = useScreenTier();
  const responsive = getResponsiveValues(tier);

  const data = useStripboardData(projectId, projectTitle);
  const {
    strips, setStrips, shootingDays, cast, loading,
    importInputRef, loadStripboardData,
    handleImportJSON, handleExportJSON, handleExportCSV, handleConfirmPrint,
  } = data;

  const [selectedStrip, setSelectedStrip]         = useState<StripboardStrip | null>(null);
  const [selectedStrips, setSelectedStrips]       = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays]           = useState<Set<string | null>>(new Set([null]));
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [draggedStrip, setDraggedStrip]           = useState<StripboardStrip | null>(null);

  const [showAssignDialog, setShowAssignDialog]     = useState(false);
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog]       = useState(false);
  const [assignDayId, setAssignDayId]               = useState('');
  const [mobileMenuAnchor, setMobileMenuAnchor]     = useState<HTMLElement | null>(null);
  const [menuAnchor, setMenuAnchor]                 = useState<HTMLElement | null>(null);

  const [viewMode, setViewMode]                             = useState<ViewMode>('board');
  const [compactView, setCompactView]                       = useState(false);
  const [showOptimizationPanel, setShowOptimizationPanel]   = useState(false);
  const [activeTab, setActiveTab]                           = useState(0);
  const [showGuide, setShowGuide]                           = useState(false);
  const [printOptions, setPrintOptions] = useState({
    header: true, stats: true, legend: true, unassignedScenes: true,
    scheduledDays: true, castInfo: true, notes: true, pageNumbers: true,
  });

  useEffect(() => { loadStripboardData(); }, [loadStripboardData]);

  const optimizationSuggestions = useOptimizationSuggestions(strips, shootingDays);

  const filters = useStripboardFilters(strips, shootingDays, optimizationSuggestions.length);
  const {
    filterStatus, setFilterStatus,
    filterLocation, setFilterLocation,
    searchQuery, setSearchQuery,
    groupBy, setGroupBy,
    sortDirection, setSortDirection,
    stripsByDay, stripsByLocation, uniqueLocations,
    stats, getSortedStrips,
  } = filters;

  const selectedStripCount = selectedStrips.size;
  const selectedStripList  = useMemo(() => strips.filter(s => selectedStrips.has(s.id)), [strips, selectedStrips]);
  const sampleSceneNumbers = useMemo(() => selectedStripList.slice(0, 3).map(s => s.sceneNumber), [selectedStripList]);
  const groupByLabel = useMemo(() => {
    const m: Record<GroupBy, string> = { day: 'Dag', location: 'Lokasjon', cast: 'Cast', status: 'Status', intExt: 'INT/EXT' };
    return m[groupBy];
  }, [groupBy]);

  const toggleStripSelection = useCallback((id: string) => {
    setSelectedStrips(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAddStrip = useCallback(() => {
    const nextNumber = (Math.max(0, ...strips.map(s => parseInt(s.sceneNumber, 10) || 0)) + 1).toString();
    const ts = Date.now();
    const newStrip: StripboardStrip = {
      id: `strip-${ts}`, sceneId: `scene-${ts}`, sceneNumber: nextNumber,
      shootingDayId: undefined, dayNumber: undefined, sortOrder: strips.length + 1,
      color: '#fff9c4', location: 'NY LOKASJON', pages: 1, cast: [],
      status: 'not-scheduled', estimatedTime: 60,
    };
    setStrips(prev => [newStrip, ...prev]);
    setSelectedStrip(newStrip);
    setSelectedStrips(new Set([newStrip.id]));
  }, [strips, setStrips]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedStrips.size === 0) return;
    setStrips(prev => prev.filter(s => !selectedStrips.has(s.id)));
    if (selectedStrip && selectedStrips.has(selectedStrip.id)) setSelectedStrip(null);
    setSelectedStrips(new Set());
  }, [selectedStrips, selectedStrip, setStrips]);

  const handleOpenAssignDialog = useCallback(() => {
    if (selectedStripList.length > 0) setSelectedStrip(selectedStripList[0]);
    setShowAssignDialog(true);
  }, [selectedStripList]);

  const handleDragStart = useCallback((e: DragEvent<HTMLElement>, strip: StripboardStrip) => {
    setDraggedStrip(strip);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', strip.id);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e: DragEvent, dayId: string | null) => {
    e.preventDefault();
    if (!draggedStrip) return;
    const updated = await productionWorkflowService.assignSceneToDay(draggedStrip.sceneId, dayId);
    if (updated) setStrips(prev => prev.map(s => s.id === updated.id ? updated : s));
    setDraggedStrip(null);
  }, [draggedStrip, setStrips]);

  const handleAssignToDay = useCallback(async () => {
    const targetIds = selectedStrips.size > 0 ? Array.from(selectedStrips) : selectedStrip ? [selectedStrip.id] : [];
    if (targetIds.length === 0) return;
    const dayId = assignDayId === 'unassign' ? null : assignDayId || null;
    const targets = strips.filter(s => targetIds.includes(s.id));
    const updates = await Promise.all(targets.map(s => productionWorkflowService.assignSceneToDay(s.sceneId, dayId)));
    setStrips(prev => prev.map(s => { const u = updates.find(u => u && u.id === s.id); return u ?? s; }));
    setShowAssignDialog(false);
    setSelectedStrip(null);
    setAssignDayId('');
    setSelectedStrips(new Set());
  }, [assignDayId, selectedStrip, selectedStrips, strips, setStrips]);

  const handleToggleDay = useCallback((dayId: string | null) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  }, []);

  const handleToggleLocation = useCallback((location: string) => {
    setExpandedLocations(prev => {
      const next = new Set(prev);
      if (next.has(location)) {
        next.delete(location);
      } else {
        next.add(location);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (viewMode === 'location') {
      setExpandedLocations(new Set(stripsByLocation.map(group => group.location)));
      return;
    }
    setExpandedDays(new Set(stripsByDay.map(day => day.dayId)));
  }, [viewMode, stripsByLocation, stripsByDay]);

  const handleCollapseAll = useCallback(() => {
    if (viewMode === 'location') {
      setExpandedLocations(new Set());
      return;
    }
    setExpandedDays(new Set());
  }, [viewMode]);

  const handleMobileMenuOpen  = useCallback((e: MouseEvent<HTMLElement>) => setMobileMenuAnchor(e.currentTarget), []);
  const handleMobileMenuClose = useCallback(() => setMobileMenuAnchor(null), []);
  const handleRefreshData     = useCallback(() => loadStripboardData(), [loadStripboardData]);

  // ─────────────────────────────────────────────────────────────────────────

  const renderDayGroup = (dayData: StripsByDay) => {
    const isExpanded   = expandedDays.has(dayData.dayId);
    const isUnassigned = dayData.dayId === null;
    const sortedStrips = getSortedStrips(dayData.strips);
    const printClass   = isUnassigned
      ? `shooting-day-group print-unassigned ${!printOptions.unassignedScenes ? 'hide-in-print' : ''}`
      : `shooting-day-group ${!printOptions.scheduledDays ? 'hide-in-print' : ''}`;

    return (
      <Paper
        key={dayData.dayId || 'unassigned'}
        className={printClass}
        sx={{ mb: { xs: 1.5, sm: 2 }, overflow: 'hidden', border: isUnassigned ? '2px dashed rgba(124,58,237,0.3)' : '1px solid', borderColor: isUnassigned ? 'transparent' : 'divider', borderRadius: { xs: 2, sm: 2.5, md: 3 }, bgcolor: 'background.paper' }}
        onDragOver={!isMobile ? handleDragOver : undefined}
        onDrop={!isMobile ? e => handleDrop(e, dayData.dayId) : undefined}
      >
        <Box
          sx={{ p: { xs: 1.5, sm: 2, md: 2.5, lg: 3 }, bgcolor: isUnassigned ? alpha('#7C3AED', 0.05) : '#7C3AED', color: isUnassigned ? 'text.primary' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: { xs: 1, sm: 1.5, md: 2 } }}
          onClick={() => handleToggleDay(dayData.dayId)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 2 }, flex: { xs: '1 0 100%', md: 'unset' } }}>
            {isExpanded ? <ExpandLessIcon sx={{ fontSize: responsive.iconSize }} /> : <ExpandMoreIcon sx={{ fontSize: responsive.iconSize }} />}
            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: responsive.fontSize.title }}>
              {isUnassigned
                ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><DescriptionIcon sx={{ fontSize: responsive.iconSize }} />{isMobile ? 'Uplanlagt' : 'Ikke planlagt'}</Box>
                : `Dag ${dayData.dayNumber}`}
            </Typography>
            {!isUnassigned && !isMobile && (
              <>
                <Chip label={new Date(dayData.date!).toLocaleDateString('nb-NO', { weekday: tier !== 'xs' ? 'short' : undefined, day: 'numeric', month: 'short' })} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
                <Chip icon={<PlaceIcon sx={{ fontSize: 12 }} />} label={dayData.location || ''} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
              </>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 2 }, flex: { xs: '1 0 100%', md: 'unset' }, justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
            <Typography variant="body2" sx={{ fontSize: responsive.fontSize.body }}>
              {dayData.strips.length}{!isMobile && ' scener'} | {dayData.totalPages}p | {formatTime(dayData.totalTime)}
            </Typography>
            {!isUnassigned && onGenerateCallSheet && responsive.showCallSheetButton && (
              <Button size="small" variant="outlined"
                onClick={e => { e.stopPropagation(); onGenerateCallSheet(dayData.dayId!); }}
                sx={{ color: 'inherit', borderColor: 'rgba(255,255,255,0.5)', fontSize: responsive.fontSize.caption, '&:hover': { borderColor: 'inherit', bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                {isMobile ? <DescriptionIcon sx={{ fontSize: 18 }} /> : 'Call Sheet'}
              </Button>
            )}
          </Box>
        </Box>

        <Collapse in={isExpanded}>
          <Box sx={{ p: compactView ? { xs: 0.75, sm: 1 } : { xs: 1, sm: 1.5, md: 2 }, bgcolor: alpha(theme.palette.background.default, 0.5), minHeight: { xs: 40, sm: 50 } }}>
            {sortedStrips.length > 0
              ? sortedStrips.map(strip => (
                  <Fragment key={`${strip.id}-${compactView ? 'c' : 'f'}`}>
                    <StripItem strip={strip} compact={compactView} isMobile={isMobile} responsive={responsive} selectedStrip={selectedStrip} selectedStrips={selectedStrips} toggleStripSelection={toggleStripSelection} handleDragStart={handleDragStart} onSelect={setSelectedStrip} onSceneSelect={onSceneSelect} printOptions={printOptions} compactView={compactView} />
                  </Fragment>
                ))
              : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: { xs: 2, sm: 3 }, fontSize: responsive.fontSize.body }}>
                  {isUnassigned
                    ? <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}><CelebrationIcon sx={{ fontSize: 18, color: 'success.main' }} />{isMobile ? 'Alt planlagt!' : 'Alle scener er planlagt!'}</Box>
                    : (isMobile ? 'Dra scener hit...' : 'Dra scener hit for å planlegge...')}
                </Typography>
              )}
          </Box>
        </Collapse>
      </Paper>
    );
  };

  const renderLocationGroup = (locGroup: LocationGroup) => {
    const isExpanded   = expandedLocations.has(locGroup.location);
    const sortedStrips = getSortedStrips(locGroup.strips);
    const intCnt = locGroup.strips.filter(s => ['#fff9c4', '#9c27b0', '#4a148c'].some(c => s.color.startsWith(c))).length;
    const extCnt = locGroup.strips.length - intCnt;

    return (
      <Paper key={locGroup.location} sx={{ mb: { xs: 1.5, sm: 2 }, overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: { xs: 2, sm: 2.5, md: 3 }, bgcolor: 'background.paper' }}>
        <Box
          sx={{ p: { xs: 1.5, sm: 2, md: 2.5 }, bgcolor: alpha('#10B981', 0.9), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: { xs: 1, sm: 1.5 } }}
          onClick={() => handleToggleLocation(locGroup.location)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 2 }, flex: { xs: '1 0 100%', md: 'unset' } }}>
            {isExpanded ? <ExpandLessIcon sx={{ fontSize: responsive.iconSize }} /> : <ExpandMoreIcon sx={{ fontSize: responsive.iconSize }} />}
            <PlaceIcon sx={{ fontSize: responsive.iconSize }} />
            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: responsive.fontSize.title }}>{locGroup.location}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1, md: 1.5 }, flexWrap: 'wrap' }}>
            {[`${locGroup.strips.length} scener`, `${locGroup.totalPages}p`, formatTime(locGroup.totalTime)].map(lbl => (
              <Chip key={lbl} label={lbl} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
            ))}
            {!isMobile && (
              <>
                <Chip icon={<IntIcon sx={{ fontSize: 12, color: 'inherit' }} />} label={`INT: ${intCnt}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'inherit', height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
                <Chip icon={<ExtIcon sx={{ fontSize: 12, color: 'inherit' }} />} label={`EXT: ${extCnt}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'inherit', height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
              </>
            )}
            {locGroup.dayNumbers.length > 0 && (
              <Chip icon={<CalendarIcon sx={{ fontSize: 12, color: 'inherit' }} />} label={`Dag ${locGroup.dayNumbers.sort((a, b) => a - b).join(', ')}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
            )}
          </Box>
        </Box>

        {!isMobile && locGroup.uniqueCast.length > 0 && (
          <Box sx={{ px: 2, py: 1, bgcolor: alpha('#10B981', 0.05), display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <PersonIcon sx={{ fontSize: 16, opacity: 0.7 }} />
            <Typography variant="caption" sx={{ opacity: 0.8, mr: 1 }}>Skuespillere:</Typography>
            {locGroup.uniqueCast.slice(0, 6).map((name, idx) => <Chip key={idx} label={name} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />)}
            {locGroup.uniqueCast.length > 6 && <Chip label={`+${locGroup.uniqueCast.length - 6}`} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />}
          </Box>
        )}

        <Collapse in={isExpanded}>
          <Box sx={{ p: compactView ? { xs: 0.75, sm: 1 } : { xs: 1, sm: 1.5, md: 2 }, bgcolor: alpha(theme.palette.background.default, 0.5), display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {sortedStrips.map(strip => (
              <Fragment key={`${strip.id}-${compactView ? 'c' : 'f'}`}>
                <StripItem strip={strip} compact={compactView} isMobile={isMobile} responsive={responsive} selectedStrip={selectedStrip} selectedStrips={selectedStrips} toggleStripSelection={toggleStripSelection} handleDragStart={handleDragStart} onSelect={setSelectedStrip} onSceneSelect={onSceneSelect} printOptions={printOptions} compactView={compactView} />
              </Fragment>
            ))}
          </Box>
        </Collapse>
      </Paper>
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: responsive.contentPadding }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center', fontSize: responsive.fontSize.body }}>Laster stripboard...</Typography>
      </Box>
    );
  }

  return (
    <Box className="stripboard-print" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 2.5, lg: 3 }, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: { xs: 1, sm: 1.5, md: 2 }, bgcolor: alpha('#7C3AED', 0.02) }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 2 }, flex: { xs: '1 0 100%', sm: 'unset' }, justifyContent: { xs: 'space-between', sm: 'flex-start' } }}>
          <Typography variant="h6" sx={{ fontSize: responsive.fontSize.title, fontWeight: 700 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TheatersIcon sx={{ fontSize: responsive.iconSize, color: '#7C3AED' }} />
              {isMobile ? 'Stripboard' : `Stripboard - ${projectTitle}`}
            </Box>
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Chip label={`${stats.shot}/${stats.total}${!isMobile ? ' skutt' : ''}`} color={stats.shot === stats.total ? 'success' : 'default'} size="small" sx={{ height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
            <Badge badgeContent={selectedStripCount} color="secondary" overlap="circular">
              <Chip icon={<PlaylistAddCheckIcon sx={{ fontSize: 14 }} />} label={isMobile ? 'Valgt' : 'Valgte scener'} size="small" sx={{ height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
            </Badge>
            <Badge badgeContent={cast.length} color="info" overlap="circular">
              <Chip icon={<GroupsIcon sx={{ fontSize: 14 }} />} label={isMobile ? 'Cast' : 'Skuespillere'} size="small" sx={{ height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />
            </Badge>
            <Chip
              icon={is4K ? <SpeedIcon sx={{ fontSize: 14 }} /> : isDesktop ? <TimelineIcon sx={{ fontSize: 14 }} /> : isTablet ? <DayIcon sx={{ fontSize: 14 }} /> : <NightIcon sx={{ fontSize: 14 }} />}
              label={tier.toUpperCase()} size="small"
              color={is4K ? 'success' : isDesktop ? 'primary' : 'default'}
              sx={{ height: responsive.chipHeight, fontSize: responsive.fontSize.caption }}
            />
            {stats.optimizationCount > 0 && (
              <Chip icon={<TrendingUpIcon sx={{ fontSize: 14 }} />} label={`${stats.optimizationCount} tips`} color="warning" size="small"
                onClick={() => setShowOptimizationPanel(p => !p)}
                sx={{ height: responsive.chipHeight, fontSize: responsive.fontSize.caption, cursor: 'pointer' }}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, alignItems: 'center' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 1.5 }} alignItems="center" sx={{ flexWrap: 'wrap' }}>
            {!isMobile && (
              <Tabs value={activeTab}
                onChange={(_, v) => { setActiveTab(v); const modes: ViewMode[] = ['board', 'location', 'timeline', 'cast']; setViewMode(modes[v] ?? 'board'); }}
                variant="scrollable" scrollButtons={false}
              >
                <Tab icon={<BoardViewIcon />} label="Board" />
                <Tab icon={<ListViewIcon />} label="Lokasjon" />
                <Tab icon={<TimelineIcon />} label="Timeline" />
                <Tab icon={<GroupsIcon />} label="Cast" />
              </Tabs>
            )}
            {!isMobile && (
              <Box sx={{ display: 'flex', bgcolor: alpha('#7C3AED', 0.1), borderRadius: 2, p: 0.5 }}>
                <Tooltip title="Dag-visning"><IconButton size="small" onClick={() => setViewMode('board')} sx={{ bgcolor: viewMode === 'board' ? '#7C3AED' : 'transparent', color: viewMode === 'board' ? '#fff' : 'inherit' }}><CalendarIcon sx={{ fontSize: responsive.iconSize - 4 }} /></IconButton></Tooltip>
                <Tooltip title="Lokasjons-visning"><IconButton size="small" onClick={() => setViewMode('location')} sx={{ bgcolor: viewMode === 'location' ? '#10B981' : 'transparent', color: viewMode === 'location' ? '#fff' : 'inherit' }}><PlaceIcon sx={{ fontSize: responsive.iconSize - 4 }} /></IconButton></Tooltip>
                <Tooltip title="Kompakt">
                  <IconButton size="small" onClick={() => setCompactView(p => !p)} sx={{ bgcolor: compactView ? '#F59E0B' : 'transparent', color: compactView ? '#fff' : 'inherit' }}>
                    {compactView ? <ZoomInMapIcon sx={{ fontSize: responsive.iconSize - 4 }} /> : <ZoomOutMapIcon sx={{ fontSize: responsive.iconSize - 4 }} />}
                  </IconButton>
                </Tooltip>
              </Box>
            )}

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <Box component="select" value={filterStatus} onChange={e => setFilterStatus((e.target as HTMLSelectElement).value as any)}
                style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'transparent', cursor: 'pointer', minWidth: 120 }}>
                <option value="all">Alle scener</option>
                <option value="not-scheduled">Ikke planlagt</option>
                <option value="scheduled">Planlagt</option>
                <option value="shot">Skutt</option>
                <option value="postponed">Utsatt</option>
              </Box>
              <Box component="select" value={filterLocation} onChange={e => setFilterLocation((e.target as HTMLSelectElement).value)}
                style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'transparent', cursor: 'pointer', minWidth: 130 }}>
                <option value="all">Alle lokasjoner</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </Box>
              <Box component="select" value={groupBy} onChange={e => setGroupBy((e.target as HTMLSelectElement).value as GroupBy)}
                style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'transparent', cursor: 'pointer', minWidth: 110 }}>
                <option value="day">Dag</option>
                <option value="location">Lokasjon</option>
                <option value="cast">Cast</option>
                <option value="status">Status</option>
                <option value="intExt">INT/EXT</option>
              </Box>
              <Tooltip title={sortDirection === 'asc' ? 'Sorter A-Å' : 'Sorter Å-A'}>
                <IconButton size="small" onClick={() => setSortDirection(p => p === 'asc' ? 'desc' : 'asc')}><SwapVertIcon sx={{ fontSize: responsive.iconSize - 2 }} /></IconButton>
              </Tooltip>
              {!isMobile && <Chip icon={<CompareArrowsIcon sx={{ fontSize: 16 }} />} label={`Grupper: ${groupByLabel}`} size="small" sx={{ height: responsive.chipHeight, fontSize: responsive.fontSize.caption }} />}
              <Box component="input" value={searchQuery} onChange={e => setSearchQuery((e.target as HTMLInputElement).value)}
                placeholder="Søk scene eller lokasjon"
                style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'transparent', minWidth: isMobile ? 150 : 190 }} />
            </Stack>

            {isMobile ? (
              <>
                <IconButton onClick={handleMobileMenuOpen} size="small"><MoreIcon /></IconButton>
                <input ref={importInputRef} type="file" accept="application/json" onChange={handleImportJSON} style={{ display: 'none' }} />
              </>
            ) : (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Ny scene"><IconButton onClick={handleAddStrip} size="small"><AddIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Tooltip>
                <Tooltip title={selectedStripCount > 0 ? 'Flytt valgte scener' : 'Velg en scene for flytting'}>
                  <span><Badge badgeContent={selectedStripCount} color="secondary" overlap="circular"><IconButton onClick={handleOpenAssignDialog} size="small" disabled={selectedStripCount === 0}><EventIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Badge></span>
                </Tooltip>
                <Tooltip title={selectedStripCount > 0 ? 'Slett valgte scener' : 'Velg scener for sletting'}>
                  <span><Badge badgeContent={selectedStripCount} color="error" overlap="circular"><IconButton onClick={handleDeleteSelected} size="small" disabled={selectedStripCount === 0}><DeleteIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Badge></span>
                </Tooltip>
                <Tooltip title="Eksporter JSON"><IconButton onClick={() => handleExportJSON(stats)} size="small"><DownloadIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Tooltip>
                <Tooltip title="Importer JSON"><IconButton onClick={() => importInputRef.current?.click()} size="small"><UploadIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Tooltip>
                <Tooltip title="Oppdater data"><IconButton onClick={handleRefreshData} size="small"><AutorenewIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Tooltip>
                <Tooltip title={showOptimizationPanel ? 'Skjul tips' : 'Vis tips'}>
                  <IconButton onClick={() => setShowOptimizationPanel(p => !p)} size="small">
                    {showOptimizationPanel ? <VisibilityOffIcon sx={{ fontSize: responsive.iconSize }} /> : <VisibilityIcon sx={{ fontSize: responsive.iconSize }} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Skriv ut / eksporter"><IconButton onClick={() => setShowPrintDialog(true)} size="small"><PrintIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Tooltip>
                <Tooltip title="Hjelp — Stripboard Guide"><IconButton onClick={() => setShowGuide(true)} size="small"><HelpIcon sx={{ fontSize: responsive.iconSize }} /></IconButton></Tooltip>
                <input ref={importInputRef} type="file" accept="application/json" onChange={handleImportJSON} style={{ display: 'none' }} />
              </Stack>
            )}
          </Stack>
        </Box>
      </Box>

      {/* ── Mobile menu ─────────────────────────────────────────────────── */}
      <Menu anchorEl={mobileMenuAnchor} open={Boolean(mobileMenuAnchor)} onClose={handleMobileMenuClose} PaperProps={{ sx: { minWidth: 200, borderRadius: 2 } }}>
        <MenuItem onClick={() => { handleAddStrip(); handleMobileMenuClose(); }}><AddIcon sx={{ mr: 1 }} /> Ny scene</MenuItem>
        <MenuItem onClick={() => { handleOpenAssignDialog(); handleMobileMenuClose(); }} disabled={selectedStripCount === 0}><EventIcon sx={{ mr: 1 }} /> Flytt valgte</MenuItem>
        <MenuItem onClick={() => { handleDeleteSelected(); handleMobileMenuClose(); }} disabled={selectedStripCount === 0}><DeleteIcon sx={{ mr: 1 }} /> Slett valgte</MenuItem>
        <Divider />
        <MenuItem onClick={() => { handleExportJSON(stats); handleMobileMenuClose(); }}><DownloadIcon sx={{ mr: 1 }} /> Eksporter JSON</MenuItem>
        <MenuItem onClick={() => { handleExportCSV(); handleMobileMenuClose(); }}><DownloadIcon sx={{ mr: 1 }} /> Eksporter CSV</MenuItem>
        <MenuItem onClick={() => { importInputRef.current?.click(); handleMobileMenuClose(); }}><UploadIcon sx={{ mr: 1 }} /> Importer JSON</MenuItem>
        <MenuItem onClick={() => { setShowPrintDialog(true); handleMobileMenuClose(); }}><PrintIcon sx={{ mr: 1 }} /> Skriv ut</MenuItem>
        <Divider />
        <MenuItem onClick={() => { setShowOptimizeDialog(true); handleMobileMenuClose(); }}><TrendingUpIcon sx={{ mr: 1 }} /> Optimaliseringsforslag</MenuItem>
        <MenuItem onClick={() => { handleRefreshData(); handleMobileMenuClose(); }}><AutorenewIcon sx={{ mr: 1 }} /> Oppdater data</MenuItem>
      </Menu>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <Box className={`print-stats ${!printOptions.stats ? 'hide-in-print' : ''}`}
        sx={{ p: { xs: 1, sm: 1.5, md: 2 }, bgcolor: alpha('#7C3AED', 0.03), borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={{ xs: 1, sm: 1.5, md: 2 }}>
          {([
            { value: stats.total, color: 'primary.main', label: isMobile ? 'Totalt' : 'Totalt scener' },
            { value: stats.shot, color: 'success.main', label: 'Skutt' },
            { value: stats.scheduled, color: 'info.main', label: 'Planlagt' },
            { value: stats.notScheduled, color: 'warning.main', label: isMobile ? 'Venter' : 'Ikke planlagt' },
          ] as const).map(s => (
            <Grid key={s.label} size={{ xs: 3, sm: 3, md: 2 }}>
              <Box textAlign="center">
                <Typography variant="h5" color={s.color} sx={{ fontSize: responsive.fontSize.stats, fontWeight: 700 }}>{s.value}</Typography>
                <Typography variant="caption" sx={{ fontSize: responsive.fontSize.caption, display: 'block' }}>{s.label}</Typography>
              </Box>
            </Grid>
          ))}
          <Grid size={{ xs: 12, sm: 12, md: 4 }}>
            <Box>
              <Typography variant="caption" sx={{ fontSize: responsive.fontSize.caption }}>Sider skutt</Typography>
              <LinearProgress variant="determinate" value={stats.totalPages ? (stats.pagesShot / stats.totalPages) * 100 : 0}
                sx={{ height: { xs: 6, sm: 7, md: 8 }, borderRadius: 4, mt: 0.5, bgcolor: alpha('#7C3AED', 0.1), '& .MuiLinearProgress-bar': { bgcolor: '#7C3AED' } }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: responsive.fontSize.caption }}>
                {stats.pagesShot.toFixed(1)} / {stats.totalPages}{!isMobile && ' sider'} ({stats.totalPages ? Math.round((stats.pagesShot / stats.totalPages) * 100) : 0}%)
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* ── Color legend ────────────────────────────────────────────────── */}
      <Box className={`print-legend ${!printOptions.legend ? 'hide-in-print' : ''}`}
        sx={{ px: { xs: 1, sm: 1.5, md: 2 }, py: { xs: 0.75, sm: 1 }, display: 'flex', gap: { xs: 0.5, sm: 0.75, md: 1 }, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider', justifyContent: { xs: 'center', sm: 'flex-start' }, alignItems: 'center' }}>
        {viewMode === 'location' && <Chip icon={<PlaceIcon sx={{ fontSize: 14 }} />} label="Lokasjons-gruppering" size="small" color="success" sx={{ mr: 1 }} />}
        {Object.entries(STRIP_COLORS).map(([key, cfg]) => (
          <Chip key={key} label={responsive.showLegendLabels ? cfg.label : cfg.label.split('/')[0]} size="small"
            sx={{ bgcolor: cfg.bg, color: cfg.textColor || 'inherit', fontSize: responsive.fontSize.caption, height: responsive.chipHeight - 2 }} />
        ))}
        {!isMobile && (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
            <Tooltip title="Utvid alle"><IconButton size="small" onClick={handleExpandAll}><ExpandMoreIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
            <Tooltip title="Skjul alle"><IconButton size="small" onClick={handleCollapseAll}><ExpandLessIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
          </Box>
        )}
      </Box>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {showOptimizationPanel && !isMobile && (
          <OptimizationPanel suggestions={optimizationSuggestions} onClose={() => setShowOptimizationPanel(false)} />
        )}
        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 1.5, md: 2 }, bgcolor: alpha('#7C3AED', 0.01) }}>
          {viewMode === 'location' && !isMobile && (
            <Paper sx={{ p: 2, mb: 2, bgcolor: alpha('#10B981', 0.03), borderRadius: 3, border: '1px solid', borderColor: alpha('#10B981', 0.2) }}>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CategoryIcon sx={{ fontSize: 18, color: '#10B981' }} /> Fugleperspektiv - Lokasjoner
              </Typography>
              <Grid container spacing={2}>
                {[
                  { value: stats.uniqueLocationsCount, color: '#10B981', label: 'Lokasjoner' },
                  { value: stats.total, color: 'primary.main', label: 'Scener totalt' },
                  { value: stats.uniqueCastCount, color: 'info.main', label: 'Skuespillere' },
                  { value: formatTime(stats.totalTime), color: 'warning.main', label: 'Total spilletid' },
                ].map(s => (
                  <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
                    <Box textAlign="center">
                      <Typography variant="h4" color={s.color} fontWeight="bold">{s.value}</Typography>
                      <Typography variant="caption">{s.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}
          {viewMode === 'location'
            ? stripsByLocation.map(lg => renderLocationGroup(lg))
            : stripsByDay.map(d => renderDayGroup(d))}
        </Box>
      </Box>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <OptimizationDialog open={showOptimizeDialog} onClose={() => setShowOptimizeDialog(false)} suggestions={optimizationSuggestions} isMobile={isMobile} />

      <PrintExportDialog
        open={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        onConfirmPrint={() => { setShowPrintDialog(false); handleConfirmPrint(printOptions, stripsByDay, stats); }}
        onExportCSV={handleExportCSV}
        printOptions={printOptions}
        setPrintOptions={setPrintOptions}
        responsive={responsive}
      />

      <AssignStripDialog
        open={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        onConfirm={handleAssignToDay}
        selectedStrip={selectedStrip}
        sampleSceneNumbers={sampleSceneNumbers}
        selectedStripCount={selectedStripCount}
        shootingDays={shootingDays}
        assignDayId={assignDayId}
        onAssignDayChange={setAssignDayId}
        isMobile={isMobile}
        responsive={responsive}
      />

      {/* ── Context menu ─────────────────────────────────────────────────── */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)} PaperProps={{ sx: { minWidth: { xs: 180, sm: 200 }, borderRadius: 2 } }}>
        <MenuItem onClick={() => { setShowAssignDialog(true); setMenuAnchor(null); }} sx={{ fontSize: responsive.fontSize.body }}><CalendarIcon sx={{ mr: 1, fontSize: responsive.iconSize }} /> Flytt til dag...</MenuItem>
        <MenuItem onClick={() => { if (selectedStrip) onSceneSelect?.(selectedStrip.sceneId); setMenuAnchor(null); }} sx={{ fontSize: responsive.fontSize.body }}><MovieIcon sx={{ mr: 1, fontSize: responsive.iconSize }} /> Gå til scene</MenuItem>
        <Divider />
        <MenuItem sx={{ fontSize: responsive.fontSize.body }}><DescriptionIcon sx={{ mr: 1, fontSize: responsive.iconSize }} /> Rediger estimat</MenuItem>
      </Menu>

      {/* ── Print header ─────────────────────────────────────────────────── */}
      <Box className={`print-header ${!printOptions.header ? 'hide-in-print' : ''}`}
        sx={{ display: 'none', '@media print': { display: printOptions.header ? 'flex !important' : 'none !important', flexDirection: 'column', alignItems: 'center', mb: 3, pb: 2, borderBottom: '2px solid #7C3AED' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box component="img" src="/role-room-assets/TheRoleRoom_Logo_Tagline.webp" alt="The Role Room" sx={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 1 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1a1a1a', mb: 0.25 }}>{projectTitle}</Typography>
            <Typography variant="subtitle1" sx={{ color: '#7C3AED', fontWeight: 600 }}>Stripboard / Opptaksplan</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Typography variant="caption" sx={{ color: '#666' }}>Generert med</Typography>
          <Typography variant="caption" sx={{ color: '#7C3AED', fontWeight: 600 }}>The Role Room</Typography>
          <Typography variant="caption" sx={{ color: '#666' }}>• {new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
        </Box>
      </Box>

      {/* ── Stripboard Guide ─────────────────────────────────────────────── */}
      <StripboardGuide open={showGuide} onClose={() => setShowGuide(false)} />

      {/* ── Print CSS ────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 10mm; }
          body * { visibility: hidden; }
          .stripboard-print, .stripboard-print * { visibility: visible !important; }
          .stripboard-print { position: absolute; left: 0; top: 0; width: 100%; height: auto !important; overflow: visible !important; background: white !important; padding: 0 !important; }
          .print-header { display: flex !important; page-break-after: avoid; }
          .hide-in-print { display: none !important; }
          .MuiCollapse-root { height: auto !important; visibility: visible !important; }
          .MuiCollapse-wrapper, .MuiCollapse-wrapperInner { display: block !important; }
          .no-print, button, .MuiIconButton-root, .MuiTooltip-popper, .MuiDialog-root { display: none !important; }
          .shooting-day-group { page-break-inside: avoid; break-inside: avoid; }
          .MuiCard-root { box-shadow: none !important; border: 1px solid #ccc !important; margin-bottom: 8px !important; page-break-inside: avoid; }
          .stripboard-print::after { content: 'Generert med The Role Room • theroleroom.no'; position: fixed; bottom: 5mm; left: 0; right: 0; text-align: center; font-size: 9px; color: #7C3AED; }
        }
      `}</style>
    </Box>
  );
};

export default StripboardPanel;
