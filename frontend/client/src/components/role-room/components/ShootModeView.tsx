import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Typography, Paper, IconButton, Button, Chip, LinearProgress, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel, Card, CardMedia, CardContent, Badge, Collapse, ToggleButtonGroup, ToggleButton, Divider, Menu, ListItemIcon, ListItemText, alpha } from "@mui/material";
import { PlayArrow, Pause, SkipNext, SkipPrevious, Check, Schedule, CameraAlt, Videocam, Add, Close, PhotoCamera, Lightbulb, Timer, ExpandMore, ExpandLess, FilterList, GridView, ViewList, FlashOn, WbSunny, Brightness7, Settings, MoreVert, Download, PictureAsPdf, TableChart, Notes, Edit, DragIndicator, Save } from "@mui/icons-material";
import { LocationsIcon as LocationOn } from "./icons/CastingIcons";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import jsPDF from "jspdf";
import { CameraMovement, type CastingShot, type ShotList, type ShotType, type CameraAngle, type ShotStatus, type Location } from "../models/casting";
import GlobalMentionHelper from "./shared/GlobalMentionHelper";

interface ShootModeViewProps {
  shotList: ShotList;
  shots: CastingShot[];
  locations: Location[];
  onUpdateShot: (shotId: string, updates: Partial<CastingShot>) => void;
  onAddShot: (shot: Partial<CastingShot>) => void;
  onReorderShots?: (reorderedShots: CastingShot[]) => void;
  onClose: () => void;
  getRoleName: (roleId: string) => string;
}

const statusConfig: Record<ShotStatus, { label: string; color: string; bgColor: string }> = {
  not_started: { label: 'Ikke startet', color: '#9e9e9e', bgColor: 'rgba(158,158,158,0.15)' },
  in_progress: { label: 'Pagar', color: '#9333ea', bgColor: 'rgba(147,51,234,0.15)' },
  completed: { label: 'Fullfort', color: '#4caf50', bgColor: 'rgba(76,175,80,0.15)' },
};

const shotTypeEquipment: Partial<Record<ShotType, string[]>> = {
  'Wide': ['Stativ', 'Vidvinkelobjektiv (16-35mm)'],
  'Medium': ['Stativ', 'Standardobjektiv (50mm)'],
  'Close-up': ['Makrolinse', 'Reflektorskjerm'],
  'Extreme Close-up': ['Makrolinse', 'Ringblits'],
  'Detail': ['Makrolinse', 'Lysbord'],
  'Establishing': ['Stativ', 'Vidvinkelobjektiv', 'ND-filter'],
  'Two Shot': ['Stativ', 'Standardobjektiv'],
  'Over Shoulder': ['Skulderrigg', '50-85mm objektiv'],
  'Point of View': ['Gimbal', 'Vidvinkel'],
};

const lightingRecommendations: Record<CameraAngle, string> = {
  'Eye Level': 'Key light 45 grader, fill light motsatt side',
  'High Angle': 'Topplys med myk diffusjon',
  'Low Angle': 'Bakgrunnsbelysning for dramatisk effekt',
  'Birds Eye': 'Jevn belysning ovenfra, unnga skygger',
  'Worms Eye': 'Rim light for silhuett, minimal frontbelysning',
  'Dutch Angle': 'Dramatisk sidelys, hoye kontraster',
  'Overhead': 'Softbox direkte ovenfra',
};

const applyMentionSuggestion = (sourceText: string | undefined, name: string): string => {
  const current = typeof sourceText === 'string' ? sourceText : '';
  if (!current.trim()) return name;
  const replaced = current.replace(/([A-Za-zÆØÅæøå][A-Za-z0-9ÆØÅæøå'.-]*)$/u, name);
  return replaced !== current ? replaced : `${current.trimEnd()} ${name}`;
};

export const ShootModeView: React.FC<ShootModeViewProps> = ({
  shotList,
  shots,
  locations,
  onUpdateShot,
  onAddShot,
  onReorderShots,
  onClose,
  getRoleName,
}) => {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));
  const [quickShotData, setQuickShotData] = useState({
    description: '',
    shotType: 'Medium' as ShotType,
    duration: 5,
  });
  const [exportMenuAnchor, setExportMenuAnchor] = useState<HTMLElement | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedShotForNotes, setSelectedShotForNotes] = useState<CastingShot | null>(null);
  const [currentNotes, setCurrentNotes] = useState('');
  const [orderedShots, setOrderedShots] = useState<CastingShot[]>(shots);

  useEffect(() => {
    const existingIds = new Set(orderedShots.map(s => s.id));
    const newShots = shots.filter(s => !existingIds.has(s.id));
    const removedIds = new Set(shots.map(s => s.id));
    const filteredOrdered = orderedShots.filter(s => removedIds.has(s.id));
    const updatedOrdered = filteredOrdered.map(s => shots.find(shot => shot.id === s.id) || s);
    setOrderedShots([...updatedOrdered, ...newShots]);
  }, [shots]);

  const filteredShots = useMemo(() => {
    if (filterLocation === 'all') return orderedShots;
    return orderedShots.filter(s => s.locationId === filterLocation);
  }, [orderedShots, filterLocation]);

  const shotsGroupedByLocation = useMemo(() => {
    const groups: Record<string, CastingShot[]> = { 'Ingen lokasjon': [] };
    locations.forEach(loc => {
      groups[loc.id] = [];
    });
    
    orderedShots.forEach(shot => {
      if (shot.locationId && groups[shot.locationId]) {
        groups[shot.locationId].push(shot);
      } else {
        groups['Ingen lokasjon'].push(shot);
      }
    });
    
    return groups;
  }, [orderedShots, locations]);

  const mentionCandidates = useMemo(() => {
    const pool = new Set<string>();
    locations.forEach((loc) => {
      if (typeof loc.name === 'string' && loc.name.trim()) pool.add(loc.name.trim());
    });
    orderedShots.forEach((shot) => {
      if (typeof shot.description === 'string' && shot.description.trim()) pool.add(shot.description.trim());
      if (typeof shot.roleId === 'string' && shot.roleId.trim()) {
        const roleName = getRoleName(shot.roleId);
        if (roleName?.trim()) pool.add(roleName.trim());
      }
    });
    pool.add('Regi');
    pool.add('Foto');
    pool.add('Lyd');
    return Array.from(pool);
  }, [getRoleName, locations, orderedShots]);

  const stats = useMemo(() => {
    const completed = orderedShots.filter(s => s.status === 'completed').length;
    const inProgress = orderedShots.filter(s => s.status === 'in_progress').length;
    const notStarted = orderedShots.filter(s => !s.status || s.status === 'not_started').length;
    const totalDuration = orderedShots.reduce((acc, s) => acc + (s.duration || 3), 0);
    const completedDuration = orderedShots
      .filter(s => s.status === 'completed')
      .reduce((acc, s) => acc + (s.duration || 3), 0);
    const remainingDuration = totalDuration - completedDuration;
    const estimatedMinutes = orderedShots.reduce((acc, s) => acc + (s.estimatedTime || 5), 0);
    const completedMinutes = orderedShots
      .filter(s => s.status === 'completed')
      .reduce((acc, s) => acc + (s.estimatedTime || 5), 0);
    
    return {
      total: orderedShots.length,
      completed,
      inProgress,
      notStarted,
      progress: orderedShots.length > 0 ? (completed / orderedShots.length) * 100 : 0,
      totalDuration,
      completedDuration,
      remainingDuration,
      estimatedMinutes,
      remainingMinutes: estimatedMinutes - completedMinutes,
    };
  }, [orderedShots]);

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
    onUpdateShot(shotId, { status: newStatus });
  }, [onUpdateShot]);

  const cycleStatus = useCallback((shot: CastingShot) => {
    const currentStatus = shot.status || 'not_started';
    const statusOrder: ShotStatus[] = ['not_started', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    handleStatusChange(shot.id, nextStatus);
  }, [handleStatusChange]);

  const handleQuickAdd = () => {
    onAddShot({
      ...quickShotData,
      cameraAngle: 'Eye Level',
      cameraMovement: 'Static',
      roleId: '',
      sceneId: shotList.sceneId,
      status: 'not_started',
    });
    setQuickAddOpen(false);
    setQuickShotData({ description: '', shotType: 'Medium', duration: 5 });
  };

  const handleOpenNotes = (shot: CastingShot) => {
    setSelectedShotForNotes(shot);
    setCurrentNotes(shot.notes || '');
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (selectedShotForNotes) {
      onUpdateShot(selectedShotForNotes.id, { notes: currentNotes });
    }
    setNotesDialogOpen(false);
    setSelectedShotForNotes(null);
    setCurrentNotes('');
  };

  const handleReorder = (newFilteredOrder: CastingShot[]) => {
    if (filterLocation === 'all') {
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
  };

  const exportToCSV = () => {
    const headers = ['Nr', 'Beskrivelse', 'Shot Type', 'Kameravinkel', 'Bevegelse', 'Status', 'Lokasjon', 'Varighet', 'Notater'];
    const rows = orderedShots.map((shot, index) => [
      index + 1,
      shot.description || '',
      shot.shotType,
      shot.cameraAngle,
      shot.cameraMovement,
      statusConfig[shot.status || 'not_started'].label,
      getLocationName(shot.locationId),
      shot.duration || 3,
      (shot.notes || '').replace(/,/g, ';'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shoot-mode-rapport-${shotList.sceneName || 'shots'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setExportMenuAnchor(null);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text(`Shoot Mode Rapport`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Scene: ${shotList.sceneName || 'Ukjent'}`, 14, 30);
    doc.text(`Dato: ${new Date().toLocaleDateString('nb-NO')}`, 14, 38);
    doc.text(`Total tid: ${formatTime(elapsedTime)}`, 14, 46);
    
    doc.setFontSize(14);
    doc.text('Fremdrift', 14, 60);
    doc.setFontSize(11);
    doc.text(`Fullfort: ${stats.completed} av ${stats.total} shots (${Math.round(stats.progress)}%)`, 14, 68);
    doc.text(`Pagar: ${stats.inProgress}`, 14, 76);
    doc.text(`Gjenstaar: ${stats.notStarted}`, 14, 84);
    
    doc.setFontSize(14);
    doc.text('Shot Liste', 14, 100);
    
    let yPos = 110;
    orderedShots.forEach((shot, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      const status = statusConfig[shot.status || 'not_started'];
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${shot.description || 'Uten beskrivelse'}`, 14, yPos);
      doc.setFontSize(9);
      doc.text(`   ${shot.shotType} | ${shot.cameraAngle} | ${status.label}`, 14, yPos + 5);
      if (shot.notes) {
        doc.text(`   Notater: ${shot.notes.substring(0, 60)}${shot.notes.length > 60 ? '...' : ''}`, 14, yPos + 10);
        yPos += 18;
      } else {
        yPos += 13;
      }
    });
    
    doc.save(`shoot-mode-rapport-${shotList.sceneName || 'shots'}-${new Date().toISOString().split('T')[0]}.pdf`);
    setExportMenuAnchor(null);
  };

  const getLocationName = (locationId?: string) => {
    if (!locationId) return 'Ingen lokasjon';
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Ukjent lokasjon';
  };

  const getEquipmentRecommendation = (shot: CastingShot): string[] => {
    if (shot.equipmentRecommendations?.length) {
      return shot.equipmentRecommendations;
    }
    return shotTypeEquipment[shot.shotType] || [];
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const currentShot = filteredShots[currentShotIndex];

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: '#0a0a0f',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header with timer and progress */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#1a1a24',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          p: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          {/* Title and scene */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.87)' }}>
              <Close />
            </IconButton>
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                {shotList.sceneName || 'Shot List'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Shoot Mode
              </Typography>
            </Box>
          </Box>

          {/* Timer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: isTimerRunning ? 'rgba(147,51,234,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${isTimerRunning ? '#9333ea' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 2,
              px: 2,
              py: 1,
            }}
          >
            <Timer sx={{ color: isTimerRunning ? '#9333ea' : '#fff' }} />
            <Typography
              variant="h5"
              sx={{
                color: isTimerRunning ? '#9333ea' : '#fff',
                fontFamily: 'monospace',
                fontWeight: 600,
                minWidth: 80,
              }}
            >
              {formatTime(elapsedTime)}
            </Typography>
            <IconButton
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              sx={{
                color: isTimerRunning ? '#9333ea' : '#4caf50',
                bgcolor: isTimerRunning ? 'rgba(147,51,234,0.1)' : 'rgba(76,175,80,0.1)',
              }}
            >
              {isTimerRunning ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Box>

          {/* Progress stats */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700 }}>
                {stats.completed}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Fullfort
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#9333ea', fontWeight: 700 }}>
                {stats.inProgress}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Pagar
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: '#9e9e9e', fontWeight: 700 }}>
                {stats.notStarted}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                Gjenstaar
              </Typography>
            </Box>
          </Box>

          {/* View mode toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.87)',
                borderColor: 'rgba(255,255,255,0.2)',
                '&.Mui-selected': {
                  color: '#00d4ff',
                  bgcolor: 'rgba(0,212,255,0.1)',
                },
              },
            }}
          >
            <ToggleButton value="grid">
              <GridView />
            </ToggleButton>
            <ToggleButton value="timeline">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Export button */}
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => setExportMenuAnchor(e.currentTarget)}
            sx={{
              borderColor: 'rgba(255,255,255,0.3)',
              color: '#fff',
              '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            Eksporter
          </Button>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
            PaperProps={{
              sx: {
                bgcolor: '#1a1a24',
                border: '1px solid rgba(255,255,255,0.1)',
              },
            }}
          >
            <MenuItem onClick={exportToPDF} sx={{ color: '#fff' }}>
              <ListItemIcon><PictureAsPdf sx={{ color: '#f44336' }} /></ListItemIcon>
              <ListItemText>Eksporter som PDF</ListItemText>
            </MenuItem>
            <MenuItem onClick={exportToCSV} sx={{ color: '#fff' }}>
              <ListItemIcon><TableChart sx={{ color: '#4caf50' }} /></ListItemIcon>
              <ListItemText>Eksporter som CSV</ListItemText>
            </MenuItem>
          </Menu>

          {/* Quick add */}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setQuickAddOpen(true)}
            sx={{
              bgcolor: '#00d4ff',
              color: '#000',
              fontWeight: 600,
              '&:hover': { bgcolor: '#00b8e6' },
            }}
          >
            Quick Mode
          </Button>
        </Box>

        {/* Progress bar */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {stats.completed} av {stats.total} shots fullfort
            </Typography>
            <Typography variant="caption" sx={{ color: '#9333ea' }}>
              Ca. {stats.remainingMinutes} min gjenstaar
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={stats.progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#4caf50',
                borderRadius: 4,
              },
            }}
          />
        </Box>
      </Paper>

      {/* Main content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {viewMode === 'grid' ? (
          <Reorder.Group
            axis="y"
            values={filteredShots}
            onReorder={handleReorder}
            as="div"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.02 }}
                  style={{ cursor: 'grab' }}
                  whileDrag={{ scale: 1.02, cursor: 'grabbing', boxShadow: '0 8px 32px rgba(0,212,255,0.3)' }}
                >
                  <ShootModeCard
                    shot={shot}
                    index={index}
                    isActive={currentShotIndex === index}
                    onSelect={() => setCurrentShotIndex(index)}
                    onCycleStatus={() => cycleStatus(shot)}
                    onOpenNotes={() => handleOpenNotes(shot)}
                    getLocationName={getLocationName}
                    getEquipmentRecommendation={getEquipmentRecommendation}
                    getRoleName={getRoleName}
                    lightingTip={lightingRecommendations[shot.cameraAngle]}
                  />
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          /* Timeline view - grouped by location */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(shotsGroupedByLocation).map(([locId, locShots]) => {
              if (locShots.length === 0) return null;
              const location = locations.find(l => l.id === locId);
              const isExpanded = expandedGroups.has(locId) || expandedGroups.has('all');
              
              return (
                <Paper
                  key={locId}
                  sx={{
                    bgcolor: '#1a1a24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    onClick={() => toggleGroup(locId)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2,
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.02)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <LocationOn sx={{ color: '#00d4ff' }} />
                      <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                        {location?.name || 'Ingen lokasjon'}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${locShots.length} shots`}
                        sx={{
                          bgcolor: 'rgba(0,212,255,0.15)',
                          color: '#00d4ff',
                        }}
                      />
                      <Chip
                        size="small"
                        label={`${locShots.filter(s => s.status === 'completed').length} fullfort`}
                        sx={{
                          bgcolor: 'rgba(76,175,80,0.15)',
                          color: '#4caf50',
                        }}
                      />
                    </Box>
                    {isExpanded ? <ExpandLess sx={{ color: 'rgba(255,255,255,0.87)' }} /> : <ExpandMore sx={{ color: 'rgba(255,255,255,0.87)' }} />}
                  </Box>
                  <Collapse in={isExpanded}>
                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {locShots.map((shot, idx) => (
                        <TimelineShotRow
                          key={shot.id}
                          shot={shot}
                          index={idx}
                          onCycleStatus={() => cycleStatus(shot)}
                          getRoleName={getRoleName}
                        />
                      ))}
                    </Box>
                  </Collapse>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Bottom bar - current shot info & navigation */}
      {currentShot && (
        <Paper
          elevation={0}
          sx={{
            bgcolor: '#1a1a24',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            p: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {/* Navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                onClick={() => setCurrentShotIndex(Math.max(0, currentShotIndex - 1))}
                disabled={currentShotIndex === 0}
                sx={{ color: '#fff' }}
              >
                <SkipPrevious />
              </IconButton>
              <Typography sx={{ color: '#fff', fontFamily: 'monospace' }}>
                {currentShotIndex + 1} / {filteredShots.length}
              </Typography>
              <IconButton
                onClick={() => setCurrentShotIndex(Math.min(filteredShots.length - 1, currentShotIndex + 1))}
                disabled={currentShotIndex === filteredShots.length - 1}
                sx={{ color: '#fff' }}
              >
                <SkipNext />
              </IconButton>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

            {/* Current shot info */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                {currentShot.description || `Shot ${currentShotIndex + 1}`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Chip size="small" label={currentShot.shotType} sx={{ bgcolor: 'rgba(0,212,255,0.15)', color: '#00d4ff' }} />
                <Chip size="small" label={currentShot.cameraAngle} sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#9333ea' }} />
                <Chip size="small" label={currentShot.cameraMovement} sx={{ bgcolor: 'rgba(156,39,176,0.15)', color: '#9c27b0' }} />
              </Box>
            </Box>

            {/* Equipment recommendation */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Lightbulb sx={{ color: '#ffc107', fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
                {getEquipmentRecommendation(currentShot).slice(0, 2).join(' + ')}
              </Typography>
            </Box>

            {/* Status change button */}
            <Button
              variant="contained"
              startIcon={currentShot.status === 'completed' ? <Check /> : currentShot.status === 'in_progress' ? <Pause /> : <PlayArrow />}
              onClick={() => cycleStatus(currentShot)}
              sx={{
                bgcolor: statusConfig[currentShot.status || 'not_started'].color,
                color: '#fff',
                fontWeight: 600,
                minWidth: 160,
                '&:hover': {
                  bgcolor: alpha(statusConfig[currentShot.status || 'not_started'].color, 0.8),
                },
              }}
            >
              {currentShot.status === 'completed' ? 'Fullfort' : currentShot.status === 'in_progress' ? 'Fullfores' : 'Start'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Quick Add Dialog */}
      <Dialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a24',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            minWidth: 400,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlashOn sx={{ color: '#00d4ff' }} />
            Quick Mode - Legg til shot
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Beskrivelse"
              value={quickShotData.description}
              onChange={(e) => setQuickShotData({ ...quickShotData, description: e.target.value })}
              placeholder="F.eks. Hero shot med produkt"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255,255,255,0.87)' }}>Shot type</InputLabel>
              <Select
                value={quickShotData.shotType}
                onChange={(e) => setQuickShotData({ ...quickShotData, shotType: e.target.value as ShotType })}
                label="Shot type"
                sx={{
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.87)' },
                }}
              >
                {(['Wide', 'Full', 'Medium', 'Medium Close-Up', 'Close-Up', 'Extreme Close-Up', 'Insert'] as ShotType[]).map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="number"
              label="Varighet (sekunder)"
              value={quickShotData.duration}
              onChange={(e) => setQuickShotData({ ...quickShotData, duration: parseInt(e.target.value) || 5 })}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button onClick={() => setQuickAddOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleQuickAdd}
            startIcon={<Add />}
            sx={{ bgcolor: '#00d4ff', color: '#000' }}
          >
            Legg til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog
        open={notesDialogOpen}
        onClose={() => setNotesDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a24',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            minWidth: 500,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Notes sx={{ color: '#9333ea' }} />
            Feltnotater - {selectedShotForNotes?.description || `Shot ${shots.findIndex(s => s.id === selectedShotForNotes?.id) + 1}`}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Notater"
            value={currentNotes}
            onChange={(e) => setCurrentNotes(e.target.value)}
            placeholder="Skriv feltnotater her... F.eks. lysforhold, problemer, ideer til forbedringer"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
          />
          <GlobalMentionHelper
            text={currentNotes}
            localCandidates={mentionCandidates}
            onApplySuggestion={(name) => setCurrentNotes((prev) => applyMentionSuggestion(prev, name))}
            autoTagTitle="Auto-tagget i notater"
            suggestionTitle="Mener du?"
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, display: 'block' }}>
            Tips: Notater lagres automatisk og inkluderes i eksportert rapport
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Button onClick={() => setNotesDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveNotes}
            startIcon={<Save />}
            sx={{ bgcolor: '#9333ea', color: '#000' }}
          >
            Lagre notater
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

interface ShootModeCardProps {
  shot: CastingShot;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onCycleStatus: () => void;
  onOpenNotes: () => void;
  getLocationName: (id?: string) => string;
  getEquipmentRecommendation: (shot: CastingShot) => string[];
  getRoleName: (id: string) => string;
  lightingTip: string;
}

const ShootModeCard: React.FC<ShootModeCardProps> = ({
  shot,
  index,
  isActive,
  onSelect,
  onCycleStatus,
  onOpenNotes,
  getLocationName,
  getEquipmentRecommendation,
  getRoleName,
  lightingTip,
}) => {
  const status = shot.status || 'not_started';
  const config = statusConfig[status];

  return (
    <Card
      onClick={onSelect}
      sx={{
        bgcolor: '#1a1a24',
        border: isActive ? '2px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'all 0.2s',
        opacity: status === 'completed' ? 0.7 : 1,
        '&:hover': {
          borderColor: isActive ? '#00d4ff' : 'rgba(255,255,255,0.3)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Thumbnail or placeholder */}
      <Box sx={{ position: 'relative' }}>
        {shot.imageUrl ? (
          <img
            src={shot.imageUrl}
            alt={shot.description || 'Shot'}
            style={{ width: '100%', height: 180, objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              height: 180,
              bgcolor: 'rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CameraAlt sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)' }} />
          </Box>
        )}

        {/* Shot number badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'rgba(0,0,0,0.8)',
            color: '#fff',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            fontWeight: 600,
          }}
        >
          #{index + 1}
        </Box>

        {/* Status badge */}
        <Chip
          size="small"
          label={config.label}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onCycleStatus();
          }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: config.bgColor,
            color: config.color,
            fontWeight: 600,
            cursor: 'pointer',
            '&:hover': { bgcolor: alpha(config.color, 0.25) },
          }}
        />

        {/* Duration badge */}
        {shot.duration && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.8)',
              color: '#fff',
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Schedule sx={{ fontSize: 14 }} />
            {shot.duration}s
          </Box>
        )}
      </Box>

      <CardContent sx={{ p: 2 }}>
        {/* Description */}
        <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
          {shot.description || `Shot ${index + 1}`}
        </Typography>

        {/* Technical info chips */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          <Chip
            size="small"
            icon={<PhotoCamera sx={{ fontSize: 14 }} />}
            label={shot.shotType}
            sx={{ bgcolor: 'rgba(0,212,255,0.15)', color: '#00d4ff', fontSize: '0.7rem' }}
          />
          <Chip
            size="small"
            label={shot.cameraAngle}
            sx={{ bgcolor: 'rgba(147,51,234,0.15)', color: '#9333ea', fontSize: '0.7rem' }}
          />
          <Chip
            size="small"
            label={shot.cameraMovement}
            sx={{ bgcolor: 'rgba(156,39,176,0.15)', color: '#9c27b0', fontSize: '0.7rem' }}
          />
        </Box>

        {/* Location */}
        {shot.locationId && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LocationOn sx={{ fontSize: 16, color: 'rgba(255,255,255,0.87)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              {getLocationName(shot.locationId)}
            </Typography>
          </Box>
        )}

        {/* Equipment recommendation */}
        <Box
          sx={{
            bgcolor: 'rgba(255,193,7,0.1)',
            border: '1px solid rgba(255,193,7,0.2)',
            borderRadius: 1,
            p: 1,
            mt: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: '#ffc107', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Lightbulb sx={{ fontSize: 14 }} />
            {getEquipmentRecommendation(shot).slice(0, 2).join(' + ')}
          </Typography>
        </Box>

        {/* Notes button and indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
          <Button
            size="small"
            startIcon={<Notes sx={{ fontSize: 16 }} />}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onOpenNotes();
            }}
            sx={{
              color: shot.notes ? '#9333ea' : 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem',
              '&:hover': { bgcolor: 'rgba(147,51,234,0.1)' },
            }}
          >
            {shot.notes ? 'Se notater' : 'Legg til notat'}
          </Button>
          {shot.notes && (
            <Chip
              size="small"
              label="Har notater"
              sx={{
                bgcolor: 'rgba(147,51,234,0.15)',
                color: '#9333ea',
                fontSize: '0.65rem',
                height: 20,
              }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

interface TimelineShotRowProps {
  shot: CastingShot;
  index: number;
  onCycleStatus: () => void;
  getRoleName: (id: string) => string;
}

const TimelineShotRow: React.FC<TimelineShotRowProps> = ({
  shot,
  index,
  onCycleStatus,
  getRoleName,
}) => {
  const status = shot.status || 'not_started';
  const config = statusConfig[status];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1.5,
        bgcolor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 1,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
      }}
    >
      {/* Index */}
      <Typography
        sx={{
          color: 'rgba(255,255,255,0.87)',
          fontFamily: 'monospace',
          minWidth: 30,
        }}
      >
        #{index + 1}
      </Typography>

      {/* Thumbnail */}
      <Box
        sx={{
          width: 80,
          height: 50,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        {shot.imageUrl ? (
          <img src={shot.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CameraAlt sx={{ fontSize: 24, color: 'rgba(255,255,255,0.2)' }} />
          </Box>
        )}
      </Box>

      {/* Description */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }} noWrap>
          {shot.description || `Shot ${index + 1}`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          <Chip size="small" label={shot.shotType} sx={{ bgcolor: 'rgba(0,212,255,0.15)', color: '#00d4ff', fontSize: '0.65rem', height: 20 }} />
          <Chip size="small" label={shot.cameraMovement} sx={{ bgcolor: 'rgba(156,39,176,0.15)', color: '#9c27b0', fontSize: '0.65rem', height: 20 }} />
        </Box>
      </Box>

      {/* Duration */}
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', minWidth: 40 }}>
        {shot.duration || 3}s
      </Typography>

      {/* Status chip */}
      <Chip
        size="small"
        label={config.label}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onCycleStatus();
        }}
        sx={{
          bgcolor: config.bgColor,
          color: config.color,
          fontWeight: 600,
          cursor: 'pointer',
          minWidth: 90,
          '&:hover': { bgcolor: alpha(config.color, 0.25) },
        }}
      />
    </Box>
  );
};

export default ShootModeView;
