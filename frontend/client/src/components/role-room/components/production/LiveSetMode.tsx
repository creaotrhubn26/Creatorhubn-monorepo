/**
 * LiveSetMode Component
 * Real-time production tracking for on-set use
 * Features: Take logging, continuity notes, scene progress, quick actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  Alert,
  Tooltip,
  Badge,
  Fab,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Warning as WarningIcon,
  Notes as NotesIcon,
  Timer as TimerIcon,
  Videocam as VideocamIcon,
  Mic as MicIcon,
  Camera as CameraIcon,
  Movie as MovieIcon,
  FiberManualRecord as RecordIcon,
  Pause as PauseIcon,
  SkipNext as NextIcon,
  SkipPrevious as PrevIcon,
  Refresh as RefreshIcon,
  FullscreenExit as ExitFullscreenIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Description as DescriptionIcon,
  Add as AddIcon,
  PhotoCamera as PhotoCameraIcon,
  VolumeUp as VolumeUpIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import {
  productionWorkflowService,
  Take,
  LiveSetStatus,
  ShootingDay,
  StripboardStrip,
} from '../../services/productionWorkflowService';

// ============================================
// TYPES
// ============================================

interface LiveSetModeProps {
  projectId: string;
  shootingDayId: string;
  onClose: () => void;
}

interface ContinuityNote {
  id: string;
  sceneId: string;
  shotId?: string;
  takeId?: string;
  type: 'continuity' | 'costume' | 'props' | 'makeup' | 'tech' | 'general';
  note: string;
  photoUrl?: string;
  timestamp: string;
  createdBy: string;
}

interface QuickNote {
  type: 'good' | 'bad' | 'tech' | 'sound' | 'focus';
  label: string;
  icon: React.ReactNode;
}

// ============================================
// CONSTANTS
// ============================================

const QUICK_NOTES: QuickNote[] = [
  { type: 'good', label: 'God take', icon: <CheckCircleIcon color="success" /> },
  { type: 'bad', label: 'Dårlig take', icon: <CancelIcon color="error" /> },
  { type: 'tech', label: 'Teknisk problem', icon: <WarningIcon color="warning" /> },
  { type: 'sound', label: 'Lyd-issue', icon: <MicIcon color="info" /> },
  { type: 'focus', label: 'Fokus-issue', icon: <CameraIcon color="secondary" /> },
];

const TAKE_STATUS_COLORS: Record<Take['status'], string> = {
  good: '#4caf50',
  ok: '#ff9800',
  bad: '#f44336',
  circle: '#2196f3',
  print: '#9c27b0',
};

// ============================================
// COMPONENT
// ============================================

const LiveSetMode: React.FC<LiveSetModeProps> = ({ projectId, shootingDayId, onClose }) => {
  // State
  const [liveStatus, setLiveStatus] = useState<LiveSetStatus | null>(null);
  const [shootingDay, setShootingDay] = useState<ShootingDay | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollStartTime, setRollStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [continuityNotes, setContinuityNotes] = useState<ContinuityNote[]>([]);
  const [noteForm, setNoteForm] = useState({ type: 'general' as ContinuityNote['type'], note: '' });
  
  // Settings
  const [settings, setSettings] = useState({
    autoIncrement: true,
    showTimer: true,
    darkMode: true,
    soundAlerts: true,
    hapticFeedback: true,
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      const [status, day] = await Promise.all([
        productionWorkflowService.getLiveSetStatus(projectId),
        productionWorkflowService.getShootingDay(shootingDayId),
      ]);
      setLiveStatus(status);
      setShootingDay(day);
    };
    loadData();
  }, [projectId, shootingDayId]);

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRolling && rollStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - rollStartTime.getTime()) / 1000));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isRolling, rollStartTime]);

  // Handlers
  const handleRoll = useCallback(async () => {
    if (!liveStatus?.currentScene || !liveStatus?.currentShot) return;
    
    setIsRolling(true);
    setRollStartTime(new Date());
    setElapsedTime(0);
    
    await productionWorkflowService.startRolling(liveStatus.currentScene, liveStatus.currentShot);
    
    // Play sound if enabled
    if (settings.soundAlerts) {
      // Would play a beep sound
    }
  }, [liveStatus, settings.soundAlerts]);

  const handleCut = useCallback(async (status: Take['status'], notes?: string) => {
    if (!isRolling) return;
    
    setIsRolling(false);
    const take = await productionWorkflowService.cut(status, notes);
    
    // Update local state
    setLiveStatus(prev => prev ? {
      ...prev,
      currentTake: prev.currentTake + 1,
      isRolling: false,
      todayTakes: [...prev.todayTakes, take],
    } : null);
    
    if (settings.soundAlerts) {
      // Would play cut sound
    }
  }, [isRolling, settings.soundAlerts]);

  const handleCircleTake = useCallback(async (takeId: string) => {
    await productionWorkflowService.circleTake(takeId, 'current-user');
    
    // Update local state
    setLiveStatus(prev => {
      if (!prev) return null;
      return {
        ...prev,
        todayTakes: prev.todayTakes.map(t => 
          t.id === takeId ? { ...t, status: 'circle' as const } : t
        ),
      };
    });
  }, []);

  const handleAddNote = useCallback(() => {
    if (!noteForm.note.trim()) return;
    
    const newNote: ContinuityNote = {
      id: `note-${Date.now()}`,
      sceneId: liveStatus?.currentScene || '',
      shotId: liveStatus?.currentShot || undefined,
      type: noteForm.type,
      note: noteForm.note,
      timestamp: new Date().toISOString(),
      createdBy: 'current-user',
    };
    
    setContinuityNotes(prev => [newNote, ...prev]);
    setNoteForm({ type: 'general', note: '' });
    setShowNoteDialog(false);
  }, [noteForm, liveStatus]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress
  const progress = liveStatus?.todayProgress || {
    plannedScenes: 0,
    completedScenes: 0,
    partialScenes: 0,
    totalSetups: 0,
    completedSetups: 0,
    pagesPlanned: 0,
    pagesShot: 0,
  };

  const progressPercent = progress.totalSetups > 0 
    ? (progress.completedSetups / progress.totalSetups) * 100 
    : 0;

  // Render
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: settings.darkMode ? '#121212' : '#f5f5f5',
        color: settings.darkMode ? '#fff' : '#1a1a1a',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: `1px solid ${settings.darkMode ? '#333' : '#ddd'}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" fontWeight="bold">
            🎬 LIVE SET MODE
          </Typography>
          {shootingDay && (
            <Chip 
              label={`Dag ${shootingDay.dayNumber} - ${shootingDay.location}`}
              color="primary"
              variant="outlined"
            />
          )}
          {isRolling && (
            <Chip 
              icon={<RecordIcon />}
              label="ROLLING"
              color="error"
              sx={{ animation: 'pulse 1s infinite' }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={() => setShowSettingsDialog(true)} sx={{ color: 'inherit' }}>
            <SettingsIcon />
          </IconButton>
          <IconButton onClick={toggleFullscreen} sx={{ color: 'inherit' }}>
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </IconButton>
          <Button variant="outlined" color="inherit" onClick={onClose}>
            Avslutt
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Recording Controls */}
        <Box sx={{ 
          width: '40%', 
          p: 3, 
          borderRight: `1px solid ${settings.darkMode ? '#333' : '#ddd'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {/* Current Scene/Shot Info */}
          <Paper
            sx={{
              p: 3,
              bgcolor: settings.darkMode ? '#1e1e1e' : '#fff',
              textAlign: 'center',
            }}
          >
            <Typography variant="overline" color="text.secondary">
              GJELDENDE SCENE
            </Typography>
            <Typography variant="h2" fontWeight="bold" sx={{ my: 1 }}>
              {liveStatus?.currentScene?.replace('scene-', 'Scene ') || '--'}
            </Typography>
            <Typography variant="h5" color="text.secondary">
              Shot {liveStatus?.currentShot?.split('-').pop() || '--'} | Take {liveStatus?.currentTake || 1}
            </Typography>
          </Paper>

          {/* Timer Display */}
          {settings.showTimer && (
            <Paper
              sx={{
                p: 3,
                bgcolor: isRolling 
                  ? 'rgba(244, 67, 54, 0.1)' 
                  : settings.darkMode ? '#1e1e1e' : '#fff',
                textAlign: 'center',
                border: isRolling ? '2px solid #f44336' : 'none',
              }}
            >
              <Typography variant="overline" color="text.secondary">
                {isRolling ? 'ROLLING' : 'KLAR'}
              </Typography>
              <Typography 
                variant="h1" 
                fontWeight="bold" 
                fontFamily="monospace"
                sx={{ color: isRolling ? '#f44336' : 'inherit' }}
              >
                {formatTime(elapsedTime)}
              </Typography>
            </Paper>
          )}

          {/* Main Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            {!isRolling ? (
              <Fab
                color="error"
                size="large"
                onClick={handleRoll}
                sx={{ 
                  width: 120, 
                  height: 120,
                  '& .MuiSvgIcon-root': { fontSize: 48 }
                }}
              >
                <PlayIcon />
              </Fab>
            ) : (
              <Fab
                color="default"
                size="large"
                onClick={() => handleCut('ok')}
                sx={{ 
                  width: 120, 
                  height: 120,
                  bgcolor: '#333',
                  color: '#fff',
                  '& .MuiSvgIcon-root': { fontSize: 48 }
                }}
              >
                <StopIcon />
              </Fab>
            )}
          </Box>

          {/* Quick Cut Buttons */}
          {isRolling && (
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleCut('good', 'God take')}
                size="large"
              >
                GOD
              </Button>
              <Button
                variant="contained"
                color="warning"
                startIcon={<StarIcon />}
                onClick={() => handleCut('circle', 'Print!')}
                size="large"
              >
                CIRCLE
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => handleCut('bad', 'Dårlig take')}
                size="large"
              >
                DÅRLIG
              </Button>
            </Box>
          )}

          {/* Quick Notes */}
          <Paper sx={{ p: 2, bgcolor: settings.darkMode ? '#1e1e1e' : '#fff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2">Hurtignotater</Typography>
              <Button 
                size="small" 
                startIcon={<AddIcon />}
                onClick={() => setShowNoteDialog(true)}
              >
                Legg til
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {QUICK_NOTES.map(qn => (
                <Tooltip key={qn.type} title={qn.label}>
                  <IconButton
                    size="small"
                    sx={{ 
                      bgcolor: settings.darkMode ? '#333' : '#e0e0e0',
                      '&:hover': { bgcolor: settings.darkMode ? '#444' : '#d0d0d0' }
                    }}
                  >
                    {qn.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </Paper>
        </Box>

        {/* Right Panel - Takes & Progress */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {/* Progress Overview */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: settings.darkMode ? '#1e1e1e' : '#fff' }}>
            <Typography variant="subtitle2" gutterBottom>
              Daglig fremgang
            </Typography>
            <Box sx={{ mb: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={progressPercent} 
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="caption" color="text.secondary">
                {progress.completedSetups} / {progress.totalSetups} setups ({Math.round(progressPercent)}%)
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid size={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">{progress.completedScenes}</Typography>
                  <Typography variant="caption">Ferdig</Typography>
                </Box>
              </Grid>
              <Grid size={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">{progress.partialScenes}</Typography>
                  <Typography variant="caption">Påbegynt</Typography>
                </Box>
              </Grid>
              <Grid size={3}>
                <Box textAlign="center">
                  <Typography variant="h4">{progress.pagesShot.toFixed(1)}</Typography>
                  <Typography variant="caption">Sider skutt</Typography>
                </Box>
              </Grid>
              <Grid size={3}>
                <Box textAlign="center">
                  <Typography variant="h4">{liveStatus?.todayTakes.length || 0}</Typography>
                  <Typography variant="caption">Takes i dag</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Tabs */}
          <Tabs 
            value={currentTab} 
            onChange={(_, v) => setCurrentTab(v)}
            sx={{ mb: 2 }}
          >
            <Tab label={`Takes (${liveStatus?.todayTakes.length || 0})`} />
            <Tab label={`Notater (${continuityNotes.length})`} />
            <Tab label="Sceneplan" />
          </Tabs>

          {/* Tab Content */}
          {currentTab === 0 && (
            <List sx={{ bgcolor: settings.darkMode ? '#1e1e1e' : '#fff', borderRadius: 1 }}>
              {liveStatus?.todayTakes.slice().reverse().map((take, idx) => (
                <React.Fragment key={take.id}>
                  <ListItem
                    secondaryAction={
                      take.status !== 'circle' && (
                        <IconButton onClick={() => handleCircleTake(take.id)}>
                          <StarBorderIcon />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: TAKE_STATUS_COLORS[take.status],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 'bold',
                        }}
                      >
                        {take.takeNumber}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight="medium">
                            {take.sceneId.replace('scene-', 'Scene ')} - Take {take.takeNumber}
                          </Typography>
                          {take.status === 'circle' && (
                            <Chip size="small" icon={<StarIcon />} label="CIRCLE" color="primary" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {take.duration}s | {take.camera} {take.lens && `| ${take.lens}`}
                          </Typography>
                          {take.notes && (
                            <Typography variant="body2" fontStyle="italic">
                              "{take.notes}"
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {idx < (liveStatus?.todayTakes.length || 0) - 1 && <Divider />}
                </React.Fragment>
              ))}
              {(!liveStatus?.todayTakes || liveStatus.todayTakes.length === 0) && (
                <ListItem>
                  <ListItemText 
                    primary="Ingen takes ennå"
                    secondary="Trykk ROLL for å starte"
                  />
                </ListItem>
              )}
            </List>
          )}

          {currentTab === 1 && (
            <List sx={{ bgcolor: settings.darkMode ? '#1e1e1e' : '#fff', borderRadius: 1 }}>
              {continuityNotes.map((note, idx) => (
                <React.Fragment key={note.id}>
                  <ListItem>
                    <ListItemIcon>
                      {note.type === 'continuity' && <HistoryIcon />}
                      {note.type === 'costume' && <DescriptionIcon />}
                      {note.type === 'props' && <LightbulbIcon />}
                      {note.type === 'makeup' && <PhotoCameraIcon />}
                      {note.type === 'tech' && <VideocamIcon />}
                      {note.type === 'general' && <NotesIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={note.note}
                      secondary={`${note.type} | ${new Date(note.timestamp).toLocaleTimeString('nb-NO')}`}
                    />
                  </ListItem>
                  {idx < continuityNotes.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {continuityNotes.length === 0 && (
                <ListItem>
                  <ListItemText 
                    primary="Ingen notater ennå"
                    secondary="Legg til kontinuitets- eller tekniske notater"
                  />
                </ListItem>
              )}
            </List>
          )}

          {currentTab === 2 && (
            <Paper sx={{ p: 2, bgcolor: settings.darkMode ? '#1e1e1e' : '#fff' }}>
              <Typography variant="subtitle2" gutterBottom>
                Scener for {shootingDay?.date}
              </Typography>
              <List dense>
                {shootingDay?.scenes.map(sceneId => (
                  <ListItem key={sceneId}>
                    <ListItemIcon>
                      <MovieIcon />
                    </ListItemIcon>
                    <ListItemText primary={sceneId.replace('scene-', 'Scene ')} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Note Dialog */}
      <Dialog 
        open={showNoteDialog} 
        onClose={() => setShowNoteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Legg til notat</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={noteForm.type}
              label="Type"
              onChange={(e) => setNoteForm({ ...noteForm, type: e.target.value as ContinuityNote['type'] })}
              MenuProps={{ sx: { zIndex: 1400 } }}
            >
              <MenuItem value="continuity">Kontinuitet</MenuItem>
              <MenuItem value="costume">Kostyme</MenuItem>
              <MenuItem value="props">Rekvisitter</MenuItem>
              <MenuItem value="makeup">Sminke</MenuItem>
              <MenuItem value="tech">Teknisk</MenuItem>
              <MenuItem value="general">Generelt</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Notat"
            value={noteForm.note}
            onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
            placeholder="Beskriv notatet..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNoteDialog(false)}>Avbryt</Button>
          <Button variant="contained" onClick={handleAddNote}>Lagre</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Live Set Innstillinger</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Switch 
                checked={settings.darkMode}
                onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
              />
            }
            label="Mørk modus"
          />
          <FormControlLabel
            control={
              <Switch 
                checked={settings.showTimer}
                onChange={(e) => setSettings({ ...settings, showTimer: e.target.checked })}
              />
            }
            label="Vis timer"
          />
          <FormControlLabel
            control={
              <Switch 
                checked={settings.autoIncrement}
                onChange={(e) => setSettings({ ...settings, autoIncrement: e.target.checked })}
              />
            }
            label="Auto-inkrement take"
          />
          <FormControlLabel
            control={
              <Switch 
                checked={settings.soundAlerts}
                onChange={(e) => setSettings({ ...settings, soundAlerts: e.target.checked })}
              />
            }
            label="Lyd-varsler"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)} variant="contained">
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Box>
  );
};

export default LiveSetMode;
