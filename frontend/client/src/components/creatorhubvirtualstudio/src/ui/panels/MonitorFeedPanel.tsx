/**
 * MonitorFeedPanel
 * 
 * UI panel for managing director, 's monitors and camera feeds.
 * Allows adding monitors, switching layouts, and selecting cameras.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Monitor,
  Videocam,
  FiberManualRecord,
  GridView,
  ViewModule,
  ViewComfy,
  PictureInPicture,
  Fullscreen,
  Add,
  Settings,
  Visibility,
  VisibilityOff,
  CenterFocusWeak,
  Timer,
  GraphicEq,
  RadioButtonChecked,
  Stop,
  Download,
  HighQuality,
  Movie,
} from '@mui/icons-material';
import { useNodes } from '../../state/store';
import { monitorFeedService, MonitorLayout } from '../../core/services/monitorFeedService';
import { multiCameraRecordingService, CameraRecording, RECORDING_QUALITY } from '../../core/services/multiCameraRecordingService';
import { logger } from '../../core/services/logger';

const log = logger.module('MonitorFeedPanel, ');

// ============================================================================
// Types
// ============================================================================

interface MonitorInstance {
  id: string;
  name: string;
  position: [number, number, number];
  layout: MonitorLayout;
  isActive: boolean;
}

// ============================================================================
// Layout Icons
// ============================================================================

const LAYOUT_OPTIONS: { value: MonitorLayout; icon: React.ReactElement; label: string }[] = [
  { value: 'single', icon: <Fullscreen />, label: 'Single' },
  { value: '2x1', icon: <ViewModule />, label: '2x1' },
  { value: '2x2', icon: <GridView />, label: '2x2' },
  { value: 'pip', icon: <PictureInPicture />, label: 'PIP' },
];

// ============================================================================
// Camera Feed Card
// ============================================================================

const CameraFeedCard: React.FC<{
  cameraId: string;
  cameraName: string;
  isLive: boolean;
  isRecording: boolean;
  onSetLive: () => void;
  onToggleRecording: () => void;
}> = ({ cameraId, cameraName, isLive, isRecording, onSetLive, onToggleRecording }) => {
  return (
    <Card 
      sx={{ 
        border: isLive ? '2px solid #ef4444' : '1px solid #333',
        bgcolor: isLive ? 'rgba(239, 68, 68, 0.1)' : 'background.paper'}}
    >
      <CardActionArea onClick={onSetLive}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Videocam sx={{ color: isLive ? '#ef4444' : 'text.secondary' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={isLive ? 600 : 400}>
                {cameraName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {cameraId.substring(0, 8)}
              </Typography>
            </Box>
            {isLive && (
              <Chip 
                label="LIVE" 
                size="small" 
                color="error" 
                icon={<FiberManualRecord sx={{ fontSize: 12 }} />}
              />
            )}
            {isRecording && (
              <Chip 
                label="REC" 
                size="small" 
                sx={{ bgcolor: '#dc2626', color: 'white' }}
                icon={<FiberManualRecord sx={{ fontSize: 12, color: 'white' }} />}
              />
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// ============================================================================
// Main Panel Component
// ============================================================================

export const MonitorFeedPanel: React.FC = () => {
  const nodes = useNodes();
  const [layout, setLayout] = useState<MonitorLayout>('single');
  const [monitors, setMonitors] = useState<MonitorInstance[]>([]);
  const [showTimecode, setShowTimecode] = useState(true);
  const [showSafeAreas, setShowSafeAreas] = useState(true);
  const [showCameraInfo, setShowCameraInfo] = useState(true);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  
  // Recording state
  const [isRecordingAll, setIsRecordingAll] = useState(false);
  const [recordingCameras, setRecordingCameras] = useState<Set<string>>(new Set());
  const [recordingQuality, setRecordingQuality] = useState<keyof typeof RECORDING_QUALITY>('high');
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [completedRecordings, setCompletedRecordings] = useState<CameraRecording[]>([]);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  
  // Get camera nodes
  const cameraNodes = nodes.filter(n => n.type === 'camera,' || n.camera);
  
  // Initialize renderer and recording service
  useEffect(() => {
    const renderer = monitorFeedService.init();
    
    // Register cameras with both services
    cameraNodes.forEach(node => {
      renderer.registerCamera({
        id: node.id,
        name: node.name || `Camera ${node.id}`,
        transform: node.transform,
        camera: node.camera,
      });
      
      // Register with recording service (need Three.js camera)
      // This will be connected when scene is available
    });
    
    // Set first camera as active
    if (cameraNodes.length > 0 && !activeCameraId) {
      setActiveCameraId(cameraNodes[0].id);
      renderer.setActiveCamera(cameraNodes[0].id);
    }
  }, [cameraNodes, activeCameraId]);
  
  // Subscribe to recording state changes
  useEffect(() => {
    const unsubscribe = multiCameraRecordingService.subscribe((state) => {
      setIsRecordingAll(state.isRecording);
      setRecordingElapsed(state.elapsedTime);
      
      const recording = new Set<string>();
      state.recordings.forEach((rec, id) => {
        if (rec.isRecording) recording.add(id);
      });
      setRecordingCameras(recording);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Recording timer
  useEffect(() => {
    if (!isRecordingAll) return;
    
    const interval = setInterval(() => {
      setRecordingElapsed(prev => prev + 0.1);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isRecordingAll]);
  
  // Update layout
  useEffect(() => {
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.setConfig({
        layout,
        showTimecode,
        showSafeAreas,
        showCameraInfo,
      });
    }
  }, [layout, showTimecode, showSafeAreas, showCameraInfo]);
  
  // Update recording quality
  useEffect(() => {
    multiCameraRecordingService.setQuality(recordingQuality);
  }, [recordingQuality]);
  
  const handleLayoutChange = (_: React.MouseEvent<HTMLElement>, newLayout: MonitorLayout | null) => {
    if (newLayout) {
      setLayout(newLayout);
    }
  };
  
  const handleSetLive = (cameraId: string) => {
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.setActiveCamera(cameraId);
      setActiveCameraId(cameraId);
    }
  };
  
  const handleToggleRecording = async (cameraId: string) => {
    const result = await multiCameraRecordingService.toggleRecording(cameraId);
    
    // If result is a CameraRecording (stop), add to completed
    if (typeof result === 'object' && result.blob) {
      setCompletedRecordings(prev => [...prev, result]);
    }
    
    // Also toggle the visual indicator
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      renderer.toggleRecording(cameraId);
    }
  };
  
  const handleStartAllRecording = async () => {
    multiCameraRecordingService.setQuality(recordingQuality);
    await multiCameraRecordingService.startAllCameras();
    
    // Update visual indicators
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      cameraNodes.forEach(node => {
        renderer.toggleRecording(node.id);
      });
    }
    
    log.info('Started recording all cameras');
  };
  
  const handleStopAllRecording = async () => {
    const recordings = await multiCameraRecordingService.stopAllCameras();
    setCompletedRecordings(prev => [...prev, ...recordings]);
    setShowDownloadDialog(true);
    
    // Update visual indicators
    const renderer = monitorFeedService.getRenderer();
    if (renderer) {
      cameraNodes.forEach(node => {
        const state = renderer as any;
        // Reset recording state
      });
    }
    
    log.info('Stopped recording all cameras, got', recordings.length'files');
  };
  
  const handleDownloadRecording = (recording: CameraRecording) => {
    multiCameraRecordingService.downloadRecording(recording);
  };
  
  const handleDownloadAll = () => {
    completedRecordings.forEach(rec => {
      if (rec.blob) multiCameraRecordingService.downloadRecording(rec);
    });
  };
  
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };
  
  const handleAddMonitor = () => {
    const newMonitor: MonitorInstance = {
      id: `monitor-${Date.now()}`,
      name: `Monitor ${monitors.length + 1}`,
      position: [0, 1.5, -2 - monitors.length * 0.6],
      layout: 'single',
      isActive: true,
    };
    setMonitors([...monitors, newMonitor]);
    
    // Dispatch event to add 3D monitor
    window.dispatchEvent(new CustomEvent('vs-add-director-monitor', {
      detail: newMonitor,
    }));
    
    log.info('Added director monitor: ', newMonitor.id);
  };
  
  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <Monitor />
            <Typography variant="h6">Director's Monitor</Typography>
          </Stack>
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={handleAddMonitor}
          >
            Add Monitor
          </Button>
        </Stack>
        
        <Divider />
        
        {/* No cameras warning */}
        {cameraNodes.length === 0 && (
          <Alert severity="info">
            No cameras in scene. Add a camera to see feeds on the monitor.
          </Alert>
        )}
        
        {/* Layout Selection */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Monitor Layout
          </Typography>
          <ToggleButtonGroup
            value={layout}
            exclusive
            onChange={handleLayoutChange}
            size="small"
            fullWidth
          >
            {LAYOUT_OPTIONS.map(option => (
              <ToggleButton key={option.value} value={option.value}>
                <Tooltip title={option.label}>
                  {option.icon}
                </Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        
        {/* Camera Feeds */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Camera Feeds ({cameraNodes.length})
          </Typography>
          <Stack spacing={1}>
            {cameraNodes.map(node => (
              <CameraFeedCard
                key={node.id}
                cameraId={node.id}
                cameraName={node.name || `Camera ${node.id.substring(0, 8)}`}
                isLive={activeCameraId === node.id}
                isRecording={false}
                onSetLive={() => handleSetLive(node.id)}
                onToggleRecording={() => handleToggleRecording(node.id)}
              />
            ))}
          </Stack>
        </Box>
        
        <Divider />
        
        {/* Overlay Options */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Overlays
          </Typography>
          <Stack spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={showTimecode}
                  onChange={(e) => setShowTimecode(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Timer fontSize="small" />
                  <Typography variant="body2">Timecode</Typography>
                </Stack>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showSafeAreas}
                  onChange={(e) => setShowSafeAreas(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CenterFocusWeak fontSize="small" />
                  <Typography variant="body2">Safe Areas</Typography>
                </Stack>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showCameraInfo}
                  onChange={(e) => setShowCameraInfo(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Videocam fontSize="small" />
                  <Typography variant="body2">Camera Info</Typography>
                </Stack>
              }
            />
          </Stack>
        </Box>
        
        {/* Active Monitors */}
        {monitors.length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Active Monitors ({monitors.length})
              </Typography>
              <Stack spacing={1}>
                {monitors.map(monitor => (
                  <Card key={monitor.id} sx={{ bgcolor: 'action.hover' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Monitor fontSize="small" />
                          <Typography variant="body2">{monitor.name}</Typography>
                        </Stack>
                        <Chip label={monitor.layout.toUpperCase()} size="small" />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </>
        )}
        
        {/* Multi-Camera Recording */}
        <Divider />
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Multi-Camera Recording
          </Typography>
          
          {/* Quality Selection */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Recording Quality</InputLabel>
            <Select
              value={recordingQuality}
              label="Recording Quality"
              onChange={(e) => setRecordingQuality(e.target.value as keyof typeof RECORDING_QUALITY)}
              disabled={isRecordingAll}
            >
              <MenuItem value="low">
                480p (2.5 Mbps) - Small files
              </MenuItem>
              <MenuItem value="medium">
                720p (5 Mbps) - Balanced
              </MenuItem>
              <MenuItem value="high">
                1080p (10 Mbps) - High quality
              </MenuItem>
              <MenuItem value="ultra">
                1440p (20 Mbps) - Maximum
              </MenuItem>
            </Select>
          </FormControl>
          
          {/* Recording Status */}
          {isRecordingAll && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              icon={<RadioButtonChecked sx={{ animation: 'pulse 1s infinite' }} />}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="body2" fontWeight={600}>
                  RECORDING {cameraNodes.length} CAMERAS
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {formatTime(recordingElapsed)}
                </Typography>
              </Stack>
            </Alert>
          )}
          
          {/* Record All / Stop All Buttons */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            {!isRecordingAll ? (
              <Button
                variant="contained"
                color="error"
                fullWidth
                startIcon={<RadioButtonChecked />}
                onClick={handleStartAllRecording}
                disabled={cameraNodes.length === 0}
              >
                Record All ({cameraNodes.length} Cameras)
              </Button>
            ) : (
              <Button
                variant="contained"
                color="warning"
                fullWidth
                startIcon={<Stop />}
                onClick={handleStopAllRecording}
              >
                Stop Recording
              </Button>
            )}
          </Stack>
          
          {/* Per-Camera Recording Status */}
          {recordingCameras.size > 0 && (
            <Stack spacing={0.5}>
              {cameraNodes.map(node => {
                const isRec = recordingCameras.has(node.id);
                if (!isRec) return null;
                return (
                  <Chip
                    key={node.id}
                    icon={<FiberManualRecord sx={{ color: '#ff0000' }} />}
                    label={`${node.name || node.id.substring(0, 8)} - REC`}
                    size="small"
                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.2)' }}
                  />
                );
              })}
            </Stack>
          )}
        </Box>
        
        {/* Completed Recordings */}
        {completedRecordings.length > 0 && (
          <>
            <Divider />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">
                  Completed Recordings ({completedRecordings.length})
                </Typography>
                <Button
                  size="small"
                  startIcon={<Download />}
                  onClick={handleDownloadAll}
                >
                  Download All
                </Button>
              </Stack>
              <Stack spacing={1}>
                {completedRecordings.slice(-5).map((rec, idx) => (
                  <Card key={`${rec.cameraId}-${idx}`} sx={{ bgcolor: 'action.hover' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack>
                          <Typography variant="body2" fontWeight={500}>
                            {rec.cameraName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rec.duration.toFixed(1)}s | {rec.blob ? (rec.blob.size / 1024 / 1024).toFixed(1) : 0} MB
                          </Typography>
                        </Stack>
                        <IconButton size="small" onClick={() => handleDownloadRecording(rec)}>
                          <Download fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </>
        )}
        
        {/* Quick Actions */}
        <Divider />
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Videocam />}
              onClick={() => {
                const renderer = monitorFeedService.getRenderer();
                renderer?.cycleCamera();
              }}
            >
              Next Camera
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FiberManualRecord sx={{ color:'#ef4444' }} />}
              onClick={() => {
                if (activeCameraId) {
                  handleToggleRecording(activeCameraId);
                }
              }}
              disabled={isRecordingAll}
            >
              Toggle REC
            </Button>
          </Stack>
        </Box>
      </Stack>
      
      {/* Download Dialog */}
      <Dialog open={showDownloadDialog} onClose={() => setShowDownloadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Movie />
            <Typography>Recording Complete</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {completedRecordings.length} camera angle(s) recorded successfully.
          </Typography>
          <List>
            {completedRecordings.map((rec, idx) => (
              <ListItem key={`${rec.cameraId}-${idx}`}>
                <ListItemIcon>
                  <Videocam />
                </ListItemIcon>
                <ListItemText
                  primary={rec.cameraName}
                  secondary={`${rec.duration.toFixed(1)} seconds | ${rec.blob ? (rec.blob.size / 1024 / 1024).toFixed(1) : 0} MB`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleDownloadRecording(rec)}>
                    <Download />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDownloadDialog(false)}>Close</Button>
          <Button variant="contained" startIcon={<Download />} onClick={handleDownloadAll}>
            Download All
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default MonitorFeedPanel;

