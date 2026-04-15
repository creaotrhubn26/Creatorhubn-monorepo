// @ts-nocheck
import { useState, useEffect, useMemo, useCallback, useRef, type FC } from "react";
import { Box, Typography, IconButton, Button, Chip, LinearProgress, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Collapse, ToggleButtonGroup, ToggleButton, alpha, Fade, Slide, useMediaQuery, useTheme } from "@mui/material";
import { PlayArrow, Pause, SkipNext, SkipPrevious, Check, Schedule, CameraAlt, Videocam, Close, Timer, FilterList, GridView, ViewList, Settings, Download, Notes, TouchApp, Fullscreen, FullscreenExit, Speed, Warning, Star, Home, ShoppingBag, Person, Event, Tune, Nature, Movie, Visibility, Edit, CheckCircle } from "@mui/icons-material";
import { LocationsIcon as LocationOn } from "./icons/CastingIcons";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import jsPDF from "jspdf";
import { PRODUCTION_PRESETS, type CastingShot, type ShotList, type ShotStatus, type Location, type ShotPriority, type MediaType, type ProductionPhase, type ProductionContext } from "../models/casting";
import { InteractiveShotCard } from "./InteractiveShotCard";
import GlobalMentionHelper from "./shared/GlobalMentionHelper";
import globalTagService from "../services/globalTagService";

interface InteractiveShotListViewProps {
  shotList: ShotList;
  shots: CastingShot[];
  locations: Location[];
  onUpdateShot: (shotId: string, updates: Partial<CastingShot>) => void;
  onAddShot: (shot: Partial<CastingShot>) => void;
  onReorderShots?: (reorderedShots: CastingShot[]) => void;
  onClose: () => void;
  getRoleName: (roleId: string) => string;
  productionDeadline?: Date;
  onUpdateShotList?: (updates: Partial<ShotList>) => void;
  initialViewMode?: ViewMode;
  autoFullscreen?: boolean;
}

type ViewMode = 'dashboard' | 'focus' | 'timeline' | 'quick';

export const InteractiveShotListView: FC<InteractiveShotListViewProps> = ({
  shotList,
  shots,
  locations,
  onUpdateShot,
  onAddShot,
  onReorderShots,
  onClose,
  getRoleName,
  productionDeadline,
  onUpdateShotList,
  initialViewMode,
  autoFullscreen = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

  const [orderedShots, setOrderedShots] = useState<CastingShot[]>(shots);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'dashboard');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<ShotPriority | 'all'>('all');
  const [filterMediaType, setFilterMediaType] = useState<MediaType | 'all'>('all');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeShot, setActiveShot] = useState<CastingShot | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedShotForNotes, setSelectedShotForNotes] = useState<CastingShot | null>(null);
  const [currentNotes, setCurrentNotes] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  
  const [productionPhase, setProductionPhase] = useState<ProductionPhase>(
    shotList.productionPhase || 'planning'
  );
  const [productionContext, setProductionContext] = useState<ProductionContext>(
    shotList.productionContext || 'custom'
  );
  const [showPresetSelector, setShowPresetSelector] = useState(false);
  const [autoTimePressureMode, setAutoTimePressureMode] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  useEffect(() => {
    if (!autoFullscreen) return;
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    };
  }, [autoFullscreen]);

  useEffect(() => {
    const newShotsMap = new Map(shots.map(s => [s.id, s]));
    const orderedIds = new Set(orderedShots.map(s => s.id));
    const newShotsToAdd = shots.filter(s => !orderedIds.has(s.id));
    const updatedOrdered = orderedShots
      .filter(s => newShotsMap.has(s.id))
      .map(s => newShotsMap.get(s.id)!);
    setOrderedShots([...updatedOrdered, ...newShotsToAdd]);
  }, [shots]);

  const filteredShots = useMemo(() => {
    let result = orderedShots;
    
    if (filterLocation !== 'all') {
      result = result.filter(s => s.locationId === filterLocation);
    }
    if (filterPriority !== 'all') {
      result = result.filter(s => (s.priority || 'important') === filterPriority);
    }
    if (filterMediaType !== 'all') {
      result = result.filter(s => (s.mediaType || 'photo') === filterMediaType);
    }
    if (showCriticalOnly) {
      result = result.filter(s => s.priority === 'critical' && s.status !== 'completed');
    }
    
    return result;
  }, [orderedShots, filterLocation, filterPriority, filterMediaType, showCriticalOnly]);

  const mentionCandidates = useMemo(
    () =>
      orderedShots
        .map((shot) => {
          if (shot.assignedRoleId) return getRoleName(shot.assignedRoleId);
          return '';
        })
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    [getRoleName, orderedShots],
  );

  const stats = useMemo(() => {
    const completed = orderedShots.filter(s => s.status === 'completed').length;
    const inProgress = orderedShots.filter(s => s.status === 'in_progress').length;
    const notStarted = orderedShots.filter(s => !s.status || s.status === 'not_started').length;
    const critical = orderedShots.filter(s => s.priority === 'critical').length;
    const criticalCompleted = orderedShots.filter(s => s.priority === 'critical' && s.status === 'completed').length;
    
    const photoShots = orderedShots.filter(s => (s.mediaType || 'photo') === 'photo').length;
    const videoShots = orderedShots.filter(s => s.mediaType === 'video').length;
    const hybridShots = orderedShots.filter(s => s.mediaType === 'hybrid').length;
    
    const totalEstimatedMinutes = orderedShots.reduce((acc, s) => acc + (s.estimatedTime || 5), 0);
    const completedMinutes = orderedShots
      .filter(s => s.status === 'completed')
      .reduce((acc, s) => acc + (s.estimatedTime || 5), 0);
    const remainingMinutes = totalEstimatedMinutes - completedMinutes;
    
    return {
      total: orderedShots.length,
      completed,
      inProgress,
      notStarted,
      critical,
      criticalCompleted,
      progress: orderedShots.length > 0 ? (completed / orderedShots.length) * 100 : 0,
      criticalProgress: critical > 0 ? (criticalCompleted / critical) * 100 : 100,
      photoShots,
      videoShots,
      hybridShots,
      totalEstimatedMinutes,
      remainingMinutes,
    };
  }, [orderedShots]);

  const timeToDeadline = useMemo(() => {
    if (!productionDeadline) return null;
    const now = new Date();
    const diff = productionDeadline.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / 60000));
  }, [productionDeadline]);

  const isTimePressure = timeToDeadline !== null && timeToDeadline < stats.remainingMinutes;

  const timePressureShotsToShow = useMemo(() => {
    if (!autoTimePressureMode || !isTimePressure) return filteredShots;
    
    const criticalRemaining = filteredShots.filter(
      s => s.priority === 'critical' && s.status !== 'completed'
    );
    const importantRemaining = filteredShots.filter(
      s => s.priority === 'important' && s.status !== 'completed'
    );
    const niceToHaveRemaining = filteredShots.filter(
      s => s.priority === 'nice_to_have' && s.status !== 'completed'
    );
    const completed = filteredShots.filter(s => s.status === 'completed');
    
    let estimatedMinutes = 0;
    const prioritizedShots: CastingShot[] = [];
    
    for (const shot of [...criticalRemaining, ...importantRemaining]) {
      const shotTime = shot.estimatedTime || 5;
      if (timeToDeadline && estimatedMinutes + shotTime <= timeToDeadline) {
        prioritizedShots.push(shot);
        estimatedMinutes += shotTime;
      }
    }
    
    if (timeToDeadline && estimatedMinutes < timeToDeadline) {
      for (const shot of niceToHaveRemaining) {
        const shotTime = shot.estimatedTime || 5;
        if (estimatedMinutes + shotTime <= timeToDeadline) {
          prioritizedShots.push(shot);
          estimatedMinutes += shotTime;
        }
      }
    }
    
    return [...prioritizedShots, ...completed];
  }, [filteredShots, autoTimePressureMode, isTimePressure, timeToDeadline]);

  const currentPreset = PRODUCTION_PRESETS[productionContext];

  const shotsForPhase = useMemo(() => {
    const shotsToUse = isTimePressure && autoTimePressureMode ? timePressureShotsToShow : filteredShots;
    
    switch (productionPhase) {
      case 'planning':
        return shotsToUse;
      case 'shooting':
        return shotsToUse.filter(s => s.status !== 'completed');
      case 'review':
        return shotsToUse.filter(s => s.status === 'completed');
      default:
        return shotsToUse;
    }
  }, [filteredShots, timePressureShotsToShow, productionPhase, isTimePressure, autoTimePressureMode]);

  const handlePhaseChange = useCallback((phase: ProductionPhase) => {
    setProductionPhase(phase);
    if (phase === 'shooting') {
      setIsTimerRunning(true);
      setSessionStartTime(new Date());
    }
    if (onUpdateShotList) {
      onUpdateShotList({ productionPhase: phase });
    }
  }, [onUpdateShotList]);

  const handlePresetSelect = useCallback((preset: ProductionContext) => {
    setProductionContext(preset);
    setShowPresetSelector(false);
    if (onUpdateShotList) {
      onUpdateShotList({ productionContext: preset });
    }
  }, [onUpdateShotList]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStatusChange = useCallback((shotId: string, newStatus: ShotStatus) => {
    const updates: Partial<CastingShot> = { status: newStatus };
    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    onUpdateShot(shotId, updates);
  }, [onUpdateShot]);

  const handleNotesClick = useCallback((shot: CastingShot) => {
    setSelectedShotForNotes(shot);
    setCurrentNotes(shot.fieldNotes || '');
    setNotesDialogOpen(true);
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (selectedShotForNotes) {
      onUpdateShot(selectedShotForNotes.id, { fieldNotes: currentNotes });
      if (currentNotes.trim().length > 0) {
        void globalTagService
          .add([
            selectedShotForNotes.title || selectedShotForNotes.id,
            ...globalTagService.parseExplicitMentions(currentNotes),
          ])
          .catch((error) => {
            console.warn('Kunne ikke oppdatere globalt tag-register fra feltnotater:', error);
          });
      }
    }
    setNotesDialogOpen(false);
    setSelectedShotForNotes(null);
    setCurrentNotes('');
  }, [selectedShotForNotes, currentNotes, onUpdateShot]);

  const handleReorder = useCallback((newFilteredOrder: CastingShot[]) => {
    if (filterLocation === 'all' && filterPriority === 'all' && filterMediaType === 'all' && !showCriticalOnly) {
      setOrderedShots(newFilteredOrder);
      if (onReorderShots) {
        onReorderShots(newFilteredOrder);
      }
    } else {
      const filteredIds = new Set(newFilteredOrder.map(s => s.id));
      const result: CastingShot[] = [];
      let filteredInsertIndex = 0;
      
      for (const shot of orderedShots) {
        if (filteredIds.has(shot.id)) {
          if (filteredInsertIndex < newFilteredOrder.length) {
            result.push(newFilteredOrder[filteredInsertIndex]);
            filteredInsertIndex++;
          }
        } else {
          result.push(shot);
        }
      }
      
      setOrderedShots(result);
      if (onReorderShots) {
        onReorderShots(result);
      }
    }
  }, [orderedShots, filterLocation, filterPriority, filterMediaType, showCriticalOnly, onReorderShots]);

  const handleShotTap = useCallback((shot: CastingShot) => {
    const currentStatus = shot.status || 'not_started';
    const statusOrder: ShotStatus[] = ['not_started', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    handleStatusChange(shot.id, nextStatus);
  }, [handleStatusChange]);

  const handleShotHold = useCallback((shot: CastingShot) => {
    handleNotesClick(shot);
  }, [handleNotesClick]);

  const handleShotSwipe = useCallback((shot: CastingShot, direction: 'left' | 'right') => {
    if (direction === 'left') {
      const currentStatus = shot.status || 'not_started';
      if (currentStatus !== 'completed') {
        handleStatusChange(shot.id, 'completed');
      }
    }
  }, [handleStatusChange]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const startSession = useCallback(() => {
    setIsTimerRunning(true);
    setSessionStartTime(new Date());
    const firstNotStarted = orderedShots.find(s => s.status !== 'completed');
    if (firstNotStarted) {
      setActiveShot(firstNotStarted);
    }
  }, [orderedShots]);

  const pauseSession = useCallback(() => {
    setIsTimerRunning(false);
  }, []);

  const navigateShot = useCallback((direction: 'prev' | 'next') => {
    if (!activeShot) return;
    const currentIndex = filteredShots.findIndex(s => s.id === activeShot.id);
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    newIndex = Math.max(0, Math.min(filteredShots.length - 1, newIndex));
    setActiveShot(filteredShots[newIndex]);
  }, [activeShot, filteredShots]);

  const getNextShot = useMemo(() => {
    return shotsForPhase.find(s => s.status !== 'completed');
  }, [shotsForPhase]);

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100vh',
        width: '100vw',
        bgcolor: '#0d0d0f',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'rgba(20,20,25,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            <Close />
          </IconButton>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, fontSize: isMobile ? 14 : 18 }}>
            {shotList.sceneName || 'Shot List'}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            bgcolor: isTimerRunning ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
            borderRadius: 2,
            px: 2,
            py: 0.75,
            border: `1px solid ${isTimerRunning ? '#4caf50' : 'rgba(255,255,255,0.1)'}`,
          }}
        >
          <Timer sx={{ fontSize: 18, color: isTimerRunning ? '#4caf50' : 'rgba(255,255,255,0.5)' }} />
          <Typography 
            variant="body2" 
            sx={{ 
              color: isTimerRunning ? '#4caf50' : '#fff',
              fontFamily: 'monospace',
              fontWeight: 600,
              fontSize: isMobile ? 14 : 16,
            }}
          >
            {formatTime(elapsedTime)}
          </Typography>
          <IconButton 
            size="small" 
            onClick={isTimerRunning ? pauseSession : startSession}
            sx={{ 
              color: isTimerRunning ? '#4caf50' : '#fff',
              p: 0.5,
            }}
          >
            {isTimerRunning ? <Pause sx={{ fontSize: 18 }} /> : <PlayArrow sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>

        {!isMobile && (
          <>
            <Chip
              label={`${stats.completed}/${stats.total}`}
              sx={{
                bgcolor: 'rgba(76,175,80,0.15)',
                color: '#4caf50',
                fontWeight: 600,
              }}
            />
            
            <IconButton onClick={() => setShowFilters(!showFilters)} sx={{ color: showFilters ? '#e91e63' : 'rgba(255,255,255,0.7)' }}>
              <FilterList />
            </IconButton>
            
            <IconButton onClick={toggleFullscreen} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </>
        )}
      </Box>

      <Collapse in={showFilters}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: 'rgba(15,15,20,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Lokasjon</InputLabel>
            <Select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              label="Lokasjon"
              sx={{ 
                color: '#fff',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
              }}
            >
              <MenuItem value="all">Alle</MenuItem>
              {locations.map(loc => (
                <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Prioritet</InputLabel>
            <Select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as ShotPriority | 'all')}
              label="Prioritet"
              sx={{ 
                color: '#fff',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
              }}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="critical">Kritisk</MenuItem>
              <MenuItem value="important">Viktig</MenuItem>
              <MenuItem value="nice_to_have">Bonus</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Type</InputLabel>
            <Select
              value={filterMediaType}
              onChange={(e) => setFilterMediaType(e.target.value as MediaType | 'all')}
              label="Type"
              sx={{ 
                color: '#fff',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
              }}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="photo">Foto</MenuItem>
              <MenuItem value="video">Video</MenuItem>
              <MenuItem value="hybrid">Hybrid</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant={showCriticalOnly ? 'contained' : 'outlined'}
            size="small"
            startIcon={<Warning />}
            onClick={() => setShowCriticalOnly(!showCriticalOnly)}
            sx={{
              borderColor: '#f44336',
              color: showCriticalOnly ? '#fff' : '#f44336',
              bgcolor: showCriticalOnly ? '#f44336' : 'transparent',
              '&:hover': {
                bgcolor: showCriticalOnly ? '#d32f2f' : 'rgba(244,67,54,0.1)',
              },
            }}
          >
            Kun kritiske
          </Button>

          <Box sx={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: 24, mx: 1 }} />

          <ToggleButtonGroup
            value={productionPhase}
            exclusive
            onChange={(_, value) => value && handlePhaseChange(value)}
            size="small"
          >
            <ToggleButton value="planning" sx={{ color: productionPhase === 'planning' ? '#2196f3' : 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }}>
              <Tooltip title="Planlegging"><Edit sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="shooting" sx={{ color: productionPhase === 'shooting' ? '#4caf50' : 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }}>
              <Tooltip title="Opptak"><Visibility sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="review" sx={{ color: productionPhase === 'review' ? '#9c27b0' : 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }}>
              <Tooltip title="Gjennomgang"><CheckCircle sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowPresetSelector(!showPresetSelector)}
            sx={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.87)',
              fontSize: 11,
            }}
          >
            {currentPreset.name}
          </Button>

          {isTimePressure && (
            <Chip
              label={autoTimePressureMode ? 'Auto-prioritering PÅ' : 'Auto-prioritering AV'}
              size="small"
              onClick={() => setAutoTimePressureMode(!autoTimePressureMode)}
              sx={{
                bgcolor: autoTimePressureMode ? 'rgba(244,67,54,0.2)' : 'rgba(255,255,255,0.05)',
                color: autoTimePressureMode ? '#f44336' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
            />
          )}
        </Box>
      </Collapse>

      <Collapse in={showPresetSelector}>
        <Box
          sx={{
            px: 2,
            py: 2,
            bgcolor: 'rgba(10,10,15,0.98)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 1.5,
          }}
        >
          {Object.values(PRODUCTION_PRESETS).map((preset) => {
            const IconComponent = {
              nature: Nature,
              shopping_bag: ShoppingBag,
              home: Home,
              movie: Movie,
              videocam: Videocam,
              person: Person,
              event: Event,
              tune: Tune,
            }[preset.icon] || Tune;
            
            return (
              <Box
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: productionContext === preset.id ? 'rgba(233,30,99,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${productionContext === preset.id ? '#e91e63' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(233,30,99,0.1)',
                    borderColor: 'rgba(233,30,99,0.5)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <IconComponent sx={{ fontSize: 18, color: productionContext === preset.id ? '#e91e63' : 'rgba(255,255,255,0.5)' }} />
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: 12 }}>
                    {preset.name}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, display: 'block' }}>
                  {preset.description}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>

      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: isTimePressure ? 'rgba(244,67,54,0.1)' : 'rgba(15,15,20,0.8)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Fremdrift
            </Typography>
            <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>
              {Math.round(stats.progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={stats.progress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#4caf50',
                borderRadius: 3,
              },
            }}
          />
        </Box>

        {!isMobile && (
          <>
            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                Gjenstår
              </Typography>
              <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                {stats.notStarted + stats.inProgress} shots
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block' }}>
                Tid
              </Typography>
              <Typography variant="body2" sx={{ color: isTimePressure ? '#f44336' : '#fff', fontWeight: 600 }}>
                ~{stats.remainingMinutes} min
              </Typography>
            </Box>

            {stats.critical > 0 && (
              <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                <Typography variant="caption" sx={{ color: '#f44336', display: 'block' }}>
                  Kritiske
                </Typography>
                <Typography variant="body2" sx={{ color: '#f44336', fontWeight: 600 }}>
                  {stats.criticalCompleted}/{stats.critical}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {viewMode === 'quick' && getNextShot ? (
          <Box
            component={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
            }}
          >
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Typography 
                variant="h2" 
                sx={{ 
                  color: '#fff', 
                  fontWeight: 700, 
                  fontSize: isMobile ? 48 : 72,
                  lineHeight: 1,
                  mb: 1,
                }}
              >
                {shotsForPhase.findIndex(s => s.id === getNextShot.id) + 1}
              </Typography>
              <Typography 
                variant="h5" 
                sx={{ 
                  color: 'rgba(255,255,255,0.87)', 
                  fontWeight: 500,
                  fontSize: isMobile ? 18 : 24,
                }}
              >
                {getNextShot.shotType}
              </Typography>
              {getNextShot.description && (
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.87)', 
                    mt: 1,
                    maxWidth: 400,
                    mx: 'auto',
                  }}
                >
                  {getNextShot.description}
                </Typography>
              )}
            </Box>

            <Box
              component={motion.div}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                handleStatusChange(getNextShot.id, 'completed');
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
              }}
              sx={{
                width: isMobile ? 200 : 280,
                height: isMobile ? 200 : 280,
                borderRadius: '50%',
                bgcolor: '#4caf50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 40px rgba(76,175,80,0.4)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: '#43a047',
                  transform: 'scale(1.02)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
              }}
            >
              <Check sx={{ fontSize: isMobile ? 80 : 120, color: '#fff' }} />
            </Box>

            <Typography 
              variant="h6" 
              sx={{ 
                color: '#4caf50', 
                mt: 3,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Trykk for ferdig
            </Typography>

            <Box sx={{ mt: 4, display: 'flex', gap: 3, opacity: 0.6 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Gjenstår</Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>{stats.notStarted + stats.inProgress}</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>Kritiske</Typography>
                <Typography variant="h6" sx={{ color: '#f44336', fontWeight: 600 }}>{stats.critical - stats.criticalCompleted}</Typography>
              </Box>
            </Box>
          </Box>
        ) : viewMode === 'quick' && !getNextShot ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle sx={{ fontSize: 120, color: '#4caf50', mb: 2 }} />
            <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700 }}>
              Alle shots fullført!
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.87)', mt: 1 }}>
              Totalt {stats.completed} shots på {formatTime(elapsedTime)}
            </Typography>
          </Box>
        ) : viewMode === 'focus' && activeShot ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            <InteractiveShotCard
              shot={activeShot}
              index={filteredShots.findIndex(s => s.id === activeShot.id)}
              isActive={true}
              onStatusChange={handleStatusChange}
              onTap={handleShotTap}
              onHold={handleShotHold}
              onSwipe={handleShotSwipe}
              onNotesClick={handleNotesClick}
              getRoleName={getRoleName}
              compactMode={false}
            />

            <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
              <IconButton
                onClick={() => navigateShot('prev')}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <SkipPrevious />
              </IconButton>

              <Button
                variant="contained"
                size="large"
                startIcon={<Check />}
                onClick={() => {
                  handleStatusChange(activeShot.id, 'completed');
                  navigateShot('next');
                }}
                sx={{
                  bgcolor: '#4caf50',
                  px: 4,
                  '&:hover': { bgcolor: '#43a047' },
                }}
              >
                Ferdig
              </Button>

              <IconButton
                onClick={() => navigateShot('next')}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <SkipNext />
              </IconButton>
            </Box>
          </Box>
        ) : (
          <Reorder.Group
            axis="y"
            values={filteredShots}
            onReorder={handleReorder}
            as="div"
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile 
                ? '1fr' 
                : isTablet 
                  ? 'repeat(2, 1fr)' 
                  : 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 16,
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            <AnimatePresence>
              {filteredShots.map((shot, index) => (
                <Reorder.Item
                  key={shot.id}
                  value={shot}
                  as="div"
                  style={{ listStyle: 'none' }}
                >
                  <InteractiveShotCard
                    shot={shot}
                    index={index}
                    isActive={activeShot?.id === shot.id}
                    onStatusChange={handleStatusChange}
                    onTap={handleShotTap}
                    onHold={handleShotHold}
                    onSwipe={handleShotSwipe}
                    onNotesClick={handleNotesClick}
                    getRoleName={getRoleName}
                    compactMode={isMobile}
                  />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </Box>

      {isMobile && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: 'rgba(20,20,25,0.98)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            flexShrink: 0,
          }}
        >
          <IconButton onClick={() => setShowFilters(!showFilters)} sx={{ color: showFilters ? '#e91e63' : 'rgba(255,255,255,0.7)' }}>
            <FilterList />
          </IconButton>
          
          <Button
            variant={viewMode === 'quick' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => {
              if (viewMode === 'quick') {
                setViewMode('dashboard');
              } else {
                setViewMode('quick');
                handlePhaseChange('shooting');
              }
            }}
            sx={{
              borderColor: '#4caf50',
              color: viewMode === 'quick' ? '#fff' : '#4caf50',
              bgcolor: viewMode === 'quick' ? '#4caf50' : 'transparent',
              minWidth: 50,
              px: 1.5,
            }}
          >
            Quick
          </Button>

          <Button
            variant={viewMode === 'focus' ? 'contained' : 'outlined'}
            size="small"
            startIcon={<TouchApp />}
            onClick={() => {
              if (viewMode === 'focus') {
                setViewMode('dashboard');
                setActiveShot(null);
              } else {
                setViewMode('focus');
                setActiveShot(getNextShot || filteredShots[0]);
              }
            }}
            sx={{
              borderColor: '#e91e63',
              color: viewMode === 'focus' ? '#fff' : '#e91e63',
              bgcolor: viewMode === 'focus' ? '#e91e63' : 'transparent',
            }}
          >
            Fokus
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', display: 'block', fontSize: 10 }}>
              Gjenstår
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
              {stats.notStarted + stats.inProgress}
            </Typography>
          </Box>
        </Box>
      )}

      <Dialog
        open={notesDialogOpen}
        onClose={() => setNotesDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1f',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Notes sx={{ color: '#e91e63' }} />
          Feltnotater
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={currentNotes}
            onChange={(e) => setCurrentNotes(e.target.value)}
            placeholder="Skriv notater fra felt..."
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.05)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              },
            }}
          />
          <GlobalMentionHelper
            text={currentNotes}
            localCandidates={mentionCandidates}
            onApplySuggestion={(name) => {
              setCurrentNotes((previous) => {
                if (!previous.trim()) return name;
                const replaced = previous.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
                return replaced !== previous ? replaced : `${previous.trimEnd()} ${name}`;
              });
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button onClick={handleSaveNotes} variant="contained" sx={{ bgcolor: '#e91e63' }}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InteractiveShotListView;
