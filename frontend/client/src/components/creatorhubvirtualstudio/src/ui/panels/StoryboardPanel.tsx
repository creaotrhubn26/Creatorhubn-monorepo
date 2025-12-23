/**
 * StoryboardPanel - Main storyboard UI for Virtual Studio
 * 
 * This panel allows users to:
 * - Create/manage storyboards
 * - Capture frames from the 3D viewport
 * - Edit frame details
 * - Export storyboards (PDF, PNG, Video)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('StoryboardPanel, ');
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Stack,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
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
  Alert,
  CircularProgress,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
} from '@mui/material';
import {
  Add,
  CameraAlt,
  Delete,
  Edit,
  GridView,
  ViewTimeline,
  ViewCarousel,
  MoreVert,
  Download,
  Settings,
  ContentCopy,
  PlayArrow,
  FolderOpen,
  Save,
  Schedule,
  Videocam,
  PhotoCamera,
  Brush,
  Close,
  SkipPrevious,
  SkipNext,
  Share,
  Comment,
  History,
} from '@mui/icons-material';

import {
  useStoryboardStore,
  useCurrentStoryboard,
  useStoryboards,
  useSelectedFrame,
  useIsCapturing,
  useViewMode,
  StoryboardFrame,
  Storyboard,
  ShotType,
  CameraAngle,
  CameraMovement,
  getShotTypeLabel,
  getShotTypeColor,
  calculateTotalDuration,
  formatDuration,
} from '../../state/storyboardStore';
import { storyboardSyncService, SyncStatus } from '../../core/services/storyboardSyncService';
import { storyboardCaptureService } from '../../core/storyboard/StoryboardCaptureService';
import { FrameEditorPanel } from './FrameEditorPanel';
import { StoryboardTimeline } from '../components/StoryboardTimeline';
import { AnimaticPlayerDialog } from '../components/AnimaticPlayer';
import { StoryboardExportDialog } from '../components/StoryboardExportDialog';
import { StoryboardSharingDialog } from '../components/StoryboardSharingDialog';
import { StoryboardCommentsPanel } from '../components/StoryboardCommentsPanel';
import { StoryboardVersionHistory } from '../components/StoryboardVersionHistory';
import { FrameContextMenu, QuickAnnotationType } from '../components/FrameContextMenu';
import { quickAnnotationService } from '../../core/storyboard/QuickAnnotationService';
import { useAccessibility, VisuallyHidden } from '../../providers/AccessibilityProvider';
import { useVirtualStudio } from '../../../VirtualStudioContext';

// =============================================================================
// Sub-Components
// =============================================================================

interface FrameCardProps {
  frame: StoryboardFrame;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLoadToScene: () => void;
  onAnnotate: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  showTechnicalInfo: boolean;
}

const FrameCard: React.FC<FrameCardProps> = ({
  frame,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onLoadToScene,
  onAnnotate,
  onContextMenu,
  showTechnicalInfo,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <Card
      sx={{
        cursor: 'pointer',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: '#1e1e2e',
        transition: 'all 0.2s', '&:hover': {
          borderColor: isSelected ? 'primary.main' : 'primary.light',
          transform: 'translateY(-2px)',
        }}}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {/* Frame Image */}
      <CardMedia
        component="img"
        height="140"
        image={frame.thumbnailUrl || frame.imageUrl}
        alt={frame.title}
        sx={{ bgcolor: '#0a0a0f' }}
      />

      {/* Frame Number Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          bgcolor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          fontSize: '0.75rem',
          fontWeight: 600}}
      >
        {frame.index + 1}
      </Box>

      {/* Shot Type Badge */}
      <Chip
        label={frame.shotType}
        size="small"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          bgcolor: getShotTypeColor(frame.shotType),
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.65rem'}}
      />

      {/* Duration Badge */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 140 + 8,
          right: 8,
          bgcolor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          px: 1,
          py: 0.25,
          borderRadius: 1,
          fontSize: '0.7rem',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5}}
      >
        <Schedule sx={{ fontSize: 12 }} />
        {frame.duration}s
      </Box>

      <CardContent sx={{ py: 1, px: 1.5 }}>
        <Typography variant="subtitle2" noWrap sx={{ color: '#fff', fontWeight: 600}}>
          {frame.title}
        </Typography>
        
        {showTechnicalInfo && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
            <Chip
              label={`f/${frame.sceneSnapshot.camera.aperture}`}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
            <Chip
              label={`${frame.sceneSnapshot.camera.focalLength}mm`}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
            <Chip
              label={`${frame.sceneSnapshot.lights.length} lights`}
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          </Stack>
        )}
      </CardContent>

      <CardActions sx={{ py: 0.5, px: 1 }}>
        <Tooltip title="Load into 3D Scene">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onLoadToScene(); }}>
            <Videocam fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Annotate Frame">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAnnotate(); }} color="primary">
            <Brush fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit Details">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setMenuAnchor(e.currentTarget);
          }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
      </CardActions>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setMenuAnchor(null); onLoadToScene(); }}>
          <ListItemIcon><Videocam fontSize="small" /></ListItemIcon>
          <ListItemText>Load into 3D Scene</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onAnnotate(); }}>
          <ListItemIcon><Brush fontSize="small" /></ListItemIcon>
          <ListItemText>Annotate / Draw</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit(); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Details</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setMenuAnchor(null); onDelete(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const StoryboardPanel: React.FC = () => {
  // Toast notifications
  const { addToast } = useVirtualStudio();

  // Accessibility
  const { announce, settings: a11ySettings } = useAccessibility();

  // Store state
  const currentStoryboard = useCurrentStoryboard();
  const storyboards = useStoryboards();
  const selectedFrame = useSelectedFrame();
  const isCapturing = useIsCapturing();
  const viewMode = useViewMode();
  
  const {
    createStoryboard,
    loadStoryboard,
    deleteStoryboard,
    addFrame,
    updateFrame,
    deleteFrame,
    selectFrame,
    setCapturing,
    setViewMode,
    settings,
  } = useStoryboardStore();

  // Sync status
  const [syncStatus, setSyncStatus] = useState<{ status: SyncStatus; lastSynced: string | null; pendingChanges: number }>({
    status: 'idle',
    lastSynced: null,
    pendingChanges: 0,
  });

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = storyboardSyncService.subscribe((state) => {
      setSyncStatus({
        status: state.status,
        lastSynced: state.lastSynced,
        pendingChanges: state.pendingChanges,
      });
    });

    // Initial sync on mount
    storyboardSyncService.fetchAll().catch(err => log.error(, 'Failed to fetch storyboards: ', err));

    return unsubscribe;
  }, []);

  // Local state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newStoryboardName, setNewStoryboardName] = useState('');
  const [newStoryboardAspect, setNewStoryboardAspect] = useState<Storyboard['aspectRatio']>('16:9');
  const [editingFrame, setEditingFrame] = useState<StoryboardFrame | null>(null);
  const [storyboardMenuAnchor, setStoryboardMenuAnchor] = useState<null | HTMLElement>(null);
  const [annotatingFrame, setAnnotatingFrame] = useState<StoryboardFrame | null>(null);
  const [animaticOpen, setAnimaticOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [sharingDialogOpen, setSharingDialogOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Context menu state
  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [contextMenuFrame, setContextMenuFrame] = useState<StoryboardFrame | null>(null);

  // Initialize capture service (would be connected to 3D scene in VirtualStudio.tsx)
  useEffect(() => {
    // Listen for scene ready event
    const handleSceneReady = (e: CustomEvent) => {
      const { renderer, scene, camera } = e.detail;
      storyboardCaptureService.initialize(renderer, scene, camera);
    };

    window.addEventListener('ch-scene-ready, ', handleSceneReady as EventListener);
    return () => {
      window.removeEventListener('ch-scene-ready', handleSceneReady as EventListener);
    };
  }, []);

  // Handle capture from 3D scene
  const handleCapture = useCallback(async () => {
    if (!currentStoryboard) {
      // Create a new storyboard first
      setCreateDialogOpen(true);
      announce('Create a storyboard first to capture frames');
      return;
    }

    announce('Capturing frame...');

    if (!storyboardCaptureService.isReady()) {
      log.warn('Capture service not ready - using placeholder');
      // For now, create a placeholder frame
      const placeholderFrame = createPlaceholderFrame();
      addFrame(placeholderFrame);
      announce('Frame captured');
      return;
    }

    setCapturing(true);
    try {
      const result = await storyboardCaptureService.capture({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        quality: 0.9,
      });

      const shotType = storyboardCaptureService.detectShotType();
      const cameraAngle = storyboardCaptureService.detectCameraAngle();

      const frameNumber = currentStoryboard.frames.length + 1;
      addFrame({
        imageUrl: result.imageUrl,
        thumbnailUrl: result.thumbnailUrl,
        title: `Shot ${frameNumber}`,
        shotType,
        cameraAngle,
        cameraMovement: 'Static',
        duration: settings.defaultDuration,
        sceneSnapshot: result.sceneSnapshot,
        status: 'draft',
      });
      announce(`Frame ${frameNumber} captured`);
      addToast({
        message: `Frame ${frameNumber} captured`,
        type: 'success',
        duration: 2000,
      });

      log.debug('Frame captured successfully');
    } catch (error) {
      log.error('Failed to capture frame: ', error);
      announce('Failed to capture frame');
      addToast({
        message: 'Failed to capture frame',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setCapturing(false);
    }
  }, [currentStoryboard, addFrame, setCapturing, settings.defaultDuration, announce, addToast]);

  // Create placeholder frame (for testing without 3D scene)
  const createPlaceholderFrame = (): Omit<StoryboardFrame, 'id' | 'index' | 'createdAt' | , 'updatedAt, '> => {
    const frameNumber = (currentStoryboard?.frames.length || 0) + 1;
    const shotType = settings.defaultShotType;
    return {
      imageUrl: `data:image/svg+xml,${encodeURIComponent(`
        <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#1a1a2e"/>
              <stop offset="100%" style="stop-color:#0d0d1a"/>
            </linearGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2a2a4a" stroke-width="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg)"/>
          <rect width="100%" height="100%" fill="url(#grid)" opacity="0.3"/>
          <rect x="96" y="54" width="1728" height="972" fill="none" stroke="#3a3a5a" stroke-width="2" stroke-dasharray="8,4"/>
          <line x1="960" y1="54" x2="960" y2="1026" stroke="#3a3a5a" stroke-width="1" opacity="0.5"/>
          <line x1="96" y1="540" x2="1824" y2="540" stroke="#3a3a5a" stroke-width="1" opacity="0.5"/>
          <circle cx="960" cy="540" r="200" fill="none" stroke="#4a4a6a" stroke-width="2" stroke-dasharray="4,4"/>
          <ellipse cx="960" cy="540" rx="100" ry="150" fill="#3a3a5a" opacity="0.3"/>
          <circle cx="960" cy="420" r="50" fill="#4a4a6a" opacity="0.3"/>
          <text x="960" y="800" text-anchor="middle" fill="#6a6a8a" font-size="36" font-family="system-ui" font-weight="600">
            Shot ${frameNumber}
          </text>
          <text x="960" y="850" text-anchor="middle" fill="#5a5a7a" font-size="20" font-family="system-ui">
            ${shotType} - Awaiting 3D Scene Capture
          </text>
          <rect x="48" y="48" width="120" height="36" rx="4" fill="#2a2a4a"/>
          <text x="108" y="72" text-anchor="middle" fill="#8a8aaa" font-size="14" font-family="system-ui">
            16:9
          </text>
        </svg>
      `)}`,
      thumbnailUrl: `data:image/svg+xml,${encodeURIComponent(`
        <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="tbg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#1a1a2e"/>
              <stop offset="100%" style="stop-color:#0d0d1a"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#tbg)"/>
          <rect x="16" y="9" width="288" height="162" fill="none" stroke="#3a3a5a" stroke-width="1"/>
          <ellipse cx="160" cy="90" rx="30" ry="45" fill="#3a3a5a" opacity="0.4"/>
          <circle cx="160" cy="55" r="15" fill="#4a4a6a" opacity="0.4"/>
          <text x="160" y="150" text-anchor="middle" fill="#6a6a8a" font-size="16" font-family="system-ui" font-weight="600">
            ${frameNumber}
          </text>
        </svg>
      `)}`,
      title: `Shot ${frameNumber}`,
      shotType: settings.defaultShotType,
      cameraAngle: 'Eye Level',
      cameraMovement: 'Static',
      duration: settings.defaultDuration,
      sceneSnapshot: {
        camera: {
          position: [0, 1.6, 3],
          rotation: [0, 0, 0],
          fov: 50,
          focalLength: 50,
          aperture: 2.8,
          focusDistance: 3,
          iso: 100,
          shutter: 1 / 125,
        },
        lights: [],
        equipment: [],
        props: [],
        capturedAt: new Date().toISOString(),
      },
      status: 'draft',
    };
  };

  // Handle create storyboard
  const handleCreateStoryboard = () => {
    if (!newStoryboardName.trim()) return;
    createStoryboard(newStoryboardName.trim(), newStoryboardAspect);
    addToast({
      message: `Storyboard "${newStoryboardName.trim()}," created`,
      type: 'success',
      duration: 3000,
    });
    setNewStoryboardName('');
    setCreateDialogOpen(false);
  };

  // Handle delete frame with toast
  const handleDeleteFrameWithToast = (frameId: string) => {
    const frame = currentStoryboard?.frames.find(f => f.id === frameId);
    deleteFrame(frameId);
    addToast({
      message: `Frame "${frame?.title || 'Untitled'}" deleted`,
      type: 'info',
      duration: 2000,
    });
  };

  // Handle animatic open with toast
  const handleAnimaticOpen = () => {
    setAnimaticOpen(true);
    addToast({
      message: 'Playing animatic',
      type: 'info',
      duration: 1500,
    });
  };

  // Handle load frame to scene
  const handleLoadToScene = (frame: StoryboardFrame) => {
    storyboardCaptureService.loadSceneSnapshot(frame.sceneSnapshot);
  };

  // Handle edit frame
  const handleEditFrame = (frame: StoryboardFrame) => {
    setEditingFrame({ ...frame });
    setEditDialogOpen(true);
  };

  // Handle right-click context menu
  const handleContextMenu = useCallback((event: React.MouseEvent, frame: StoryboardFrame) => {
    event.preventDefault();
    setContextMenuPosition({ top: event.clientY, left: event.clientX });
    setContextMenuFrame(frame);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuPosition(null);
    setContextMenuFrame(null);
  }, []);

  // Handle quick annotation from context menu
  const handleQuickAnnotation = useCallback(async (frame: StoryboardFrame, type: QuickAnnotationType) => {
    try {
      const annotatedUrl = await quickAnnotationService.addAnnotation(frame, type);
      updateFrame(frame.id, { imageUrl: annotatedUrl });
    } catch (error) {
      log.error('Failed to add quick annotation:', error);
    }
  }, [updateFrame]);

  // Handle save frame edit
  const handleSaveFrameEdit = () => {
    if (editingFrame) {
      updateFrame(editingFrame.id, editingFrame);
      setEditDialogOpen(false);
      setEditingFrame(null);
    }
  };

  // Calculate total duration
  const totalDuration = currentStoryboard ? calculateTotalDuration(currentStoryboard.frames) : 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#12121a' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#1a1a2e',
          borderBottom: 1,
          borderColor: 'divider'}}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <PhotoCamera sx={{ color: 'primary.main' }} />
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600}}>
                Storyboard
              </Typography>
              {currentStoryboard && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {currentStoryboard.name} • {currentStoryboard.frames.length} frames • {formatDuration(totalDuration)}
                </Typography>
              )}
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, v) => v && setViewMode(v)}
              size="small"
            >
              <ToggleButton value="grid">
                <Tooltip title="Grid View"><GridView fontSize="small" /></Tooltip>
              </ToggleButton>
              <ToggleButton value="timeline">
                <Tooltip title="Timeline View"><ViewTimeline fontSize="small" /></Tooltip>
              </ToggleButton>
              <ToggleButton value="single">
                <Tooltip title="Single Frame"><ViewCarousel fontSize="small" /></Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Sync Status Indicator */}
            <Tooltip title={
              syncStatus.status === 'syncing' ? 'Syncing...' :
              syncStatus.status === 'error' ? 'Sync error - click to retry' :
              syncStatus.pendingChanges > 0 ? `${syncStatus.pendingChanges} pending changes` :
              syncStatus.lastSynced ? `Synced ${new Date(syncStatus.lastSynced).toLocaleTimeString()}` :
              'Not synced'
            }>
              <IconButton
                size="small"
                onClick={() => storyboardSyncService.pushChanges()}
                sx={{
                  color: syncStatus.status === 'error' ? 'error.main' :
                         syncStatus.status === 'syncing' ? 'info.main' :
                         syncStatus.pendingChanges > 0 ? 'warning.main' :
                         'success.main'}}
              >
                {syncStatus.status === 'syncing' ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <Badge badgeContent={syncStatus.pendingChanges} color="warning" max={99}>
                    <Save fontSize="small" />
                  </Badge>
                )}
              </IconButton>
            </Tooltip>

            {/* Storyboard Menu */}
            <IconButton onClick={(e) => setStoryboardMenuAnchor(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>

      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          bgcolor: '#16162a',
          borderBottom: 1,
          borderColor: 'divider'}}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Capture Button */}
          <Button
            variant="contained"
            startIcon={isCapturing ? <CircularProgress size={16} color="inherit" /> : <CameraAlt />}
            onClick={handleCapture}
            disabled={isCapturing}
            sx={{ fontWeight: 600}}
          >
            {isCapturing ? 'Capturing...' : 'Capture Frame'}
          </Button>

          <Divider orientation="vertical" flexItem />

          {/* Storyboard Selection */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={currentStoryboard?.id || ''}
              onChange={(e) => e.target.value && loadStoryboard(e.target.value)}
              displayEmpty
              sx={{ bgcolor: '#1e1e36' }}
            >
              <MenuItem value="" disabled>
                <em>Select Storyboard</em>
              </MenuItem>
              {storyboards.map((sb) => (
                <MenuItem key={sb.id} value={sb.id}>
                  {sb.name} ({sb.frames.length} frames)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="New Storyboard">
            <IconButton onClick={() => setCreateDialogOpen(true)} color="primary">
              <Add />
            </IconButton>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          {/* Play Animatic */}
          {currentStoryboard && currentStoryboard.frames.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<PlayArrow />}
              onClick={() => setAnimaticOpen(true)}
              size="small"
              sx={{ mr: 2 }}
            >
              Play Animatic
            </Button>
          )}

          {/* Export Button */}
          {currentStoryboard && currentStoryboard.frames.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => setExportDialogOpen(true)}
              size="small"
            >
              Export
            </Button>
          )}

          {/* Collaboration Buttons */}
          {currentStoryboard && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <Tooltip title="Comments">
                <IconButton
                  onClick={() => setShowComments(!showComments)}
                  color={showComments ? 'primary' : 'default'}
                >
                  <Comment />
                </IconButton>
              </Tooltip>
              <Tooltip title="Version History">
                <IconButton
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  color={showVersionHistory ? 'primary' : 'default'}
                >
                  <History />
                </IconButton>
              </Tooltip>
              <Tooltip title="Share">
                <IconButton onClick={() => setSharingDialogOpen(true)}>
                  <Share />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      </Paper>

      {/* Content with Side Panels */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main Content */}
        <Box sx={{ flex: 1, overflow: viewMode === 'timeline' ? 'hidden' : 'auto', p: viewMode === 'timeline' ? 0 : 2 }}>
          {!currentStoryboard ? (
          // No storyboard selected
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2}}
          >
            <PhotoCamera sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">
              No Storyboard Selected
            </Typography>
            <Typography variant="body2" color="text.disabled" textAlign="center">
              Create a new storyboard to start capturing frames<br />
              from your 3D scene.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Storyboard
            </Button>
          </Box>
        ) : currentStoryboard.frames.length === 0 ? (
          // Empty storyboard
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2}}
          >
            <CameraAlt sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography variant="h6" color="text.secondary">
              No Frames Yet
            </Typography>
            <Typography variant="body2" color="text.disabled" textAlign="center">
              Set up your 3D scene and click "Capture Frame"<br />
              to add frames to your storyboard.
            </Typography>
            <Button
              variant="contained"
              startIcon={<CameraAlt />}
              onClick={handleCapture}
            >
              Capture First Frame
            </Button>
          </Box>
        ) : viewMode === 'timeline' ? (
          // Timeline View
          <StoryboardTimeline
            onFrameClick={(frame) => selectFrame(frame.id)}
            onFrameDoubleClick={(frame) => setAnnotatingFrame(frame)}
          />
        ) : viewMode === 'single' ? (
          // Single Frame View
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2}}
          >
            {selectedFrame ? (
              <>
                <Box
                  component="img"
                  src={selectedFrame.imageUrl}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 'calc(100% - 100px)',
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'}}
                />
                <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="center">
                  <IconButton
                    onClick={() => {
                      const idx = currentStoryboard.frames.findIndex(f => f.id === selectedFrame.id);
                      if (idx > 0) selectFrame(currentStoryboard.frames[idx - 1].id);
                    }}
                    disabled={currentStoryboard.frames.findIndex(f => f.id === selectedFrame.id) === 0}
                  >
                    <SkipPrevious />
                  </IconButton>
                  <Typography variant="h6">
                    {selectedFrame.index + 1} / {currentStoryboard.frames.length}
                  </Typography>
                  <IconButton
                    onClick={() => {
                      const idx = currentStoryboard.frames.findIndex(f => f.id === selectedFrame.id);
                      if (idx < currentStoryboard.frames.length - 1) selectFrame(currentStoryboard.frames[idx + 1].id);
                    }}
                    disabled={currentStoryboard.frames.findIndex(f => f.id === selectedFrame.id) === currentStoryboard.frames.length - 1}
                  >
                    <SkipNext />
                  </IconButton>
                </Stack>
                <Typography variant="subtitle1" sx={{ mt: 1 }}>
                  {selectedFrame.title} • {selectedFrame.shotType} • {selectedFrame.duration}s
                </Typography>
              </>
            ) : (
              <Typography color="text.secondary">
                Select a frame to view
              </Typography>
            )}
          </Box>
        ) : (
          // Grid View (default)
          <Grid container spacing={2}>
            {currentStoryboard.frames.map((frame) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={frame.id}>
                <FrameCard
                  frame={frame}
                  isSelected={selectedFrame?.id === frame.id}
                  onSelect={() => selectFrame(frame.id)}
                  onEdit={() => handleEditFrame(frame)}
                  onDelete={() => deleteFrame(frame.id)}
                  onLoadToScene={() => handleLoadToScene(frame)}
                  onAnnotate={() => setAnnotatingFrame(frame)}
                  onContextMenu={(e) => handleContextMenu(e, frame)}
                  showTechnicalInfo={settings.showTechnicalInfo}
                />
              </Grid>
            ))}
          </Grid>
        )}
        </Box>

        {/* Comments Side Panel */}
        {showComments && currentStoryboard && (
          <Box
            sx={{
              width: 360,
              borderLeft: 1,
              borderColor: 'divider',
              height: '100%',
              overflow: 'hidden'}}
          >
            <StoryboardCommentsPanel
              storyboardId={currentStoryboard.id}
              frameId={selectedFrame?.id}
              frame={selectedFrame || undefined}
            />
          </Box>
        )}

        {/* Version History Side Panel */}
        {showVersionHistory && currentStoryboard && (
          <Box
            sx={{
              width: 360,
              borderLeft: 1,
              borderColor: 'divider',
              height: '100%',
              overflow: 'hidden'}}
          >
            <StoryboardVersionHistory storyboardId={currentStoryboard.id} />
          </Box>
        )}
      </Box>

      {/* Create Storyboard Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Storyboard</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Storyboard Name"
              fullWidth
              value={newStoryboardName}
              onChange={(e) => setNewStoryboardName(e.target.value)}
              placeholder="e.g., Product Launch Campaign"
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>Aspect Ratio</InputLabel>
              <Select
                value={newStoryboardAspect}
                onChange={(e) => setNewStoryboardAspect(e.target.value as Storyboard['aspectRatio'])}
                label="Aspect Ratio"
              >
                <MenuItem value="16:9">16:9 (HD / 4K)</MenuItem>
                <MenuItem value="4:3">4:3 (Classic)</MenuItem>
                <MenuItem value="2.35:1">2.35:1 (Cinemascope)</MenuItem>
                <MenuItem value="1:1">1:1 (Square)</MenuItem>
                <MenuItem value="9:16">9:16 (Vertical)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateStoryboard}
            disabled={!newStoryboardName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Frame Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Frame</DialogTitle>
        <DialogContent>
          {editingFrame && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Title"
                fullWidth
                value={editingFrame.title}
                onChange={(e) => setEditingFrame({ ...editingFrame, title: e.target.value })}
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Shot Type</InputLabel>
                  <Select
                    value={editingFrame.shotType}
                    onChange={(e) => setEditingFrame({ ...editingFrame, shotType: e.target.value as ShotType })}
                    label="Shot Type"
                  >
                    {(['ECU','CU','MCU','MS','MLS','LS','ELS','OTS','POV','Insert','Establishing'] as ShotType[]).map((type) => (
                      <MenuItem key={type} value={type}>{getShotTypeLabel(type)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Duration (s)"
                  type="number"
                  value={editingFrame.duration}
                  onChange={(e) => setEditingFrame({ ...editingFrame, duration: parseInt(e.target.value) || 5 })}
                  sx={{ width: 120 }}
                />
              </Stack>
              <FormControl fullWidth>
                <InputLabel>Camera Angle</InputLabel>
                <Select
                  value={editingFrame.cameraAngle}
                  onChange={(e) => setEditingFrame({ ...editingFrame, cameraAngle: e.target.value as CameraAngle })}
                  label="Camera Angle"
                >
                  {(['Eye Level','High Angle','Low Angle','Birds Eye','Worms Eye','Dutch Angle','Overhead'] as CameraAngle[]).map((angle) => (
                    <MenuItem key={angle} value={angle}>{angle}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Camera Movement</InputLabel>
                <Select
                  value={editingFrame.cameraMovement}
                  onChange={(e) => setEditingFrame({ ...editingFrame, cameraMovement: e.target.value as CameraMovement })}
                  label="Camera Movement"
                >
                  {(['Static','Pan','Tilt','Dolly','Truck','Crane','Handheld','Steadicam','Zoom','Orbit'] as CameraMovement[]).map((movement) => (
                    <MenuItem key={movement} value={movement}>{movement}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Description / Notes"
                fullWidth
                multiline
                rows={3}
                value={editingFrame.description || ', '}
                onChange={(e) => setEditingFrame({ ...editingFrame, description: e.target.value })}
                placeholder="Add notes about this shot..."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFrameEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Storyboard Menu */}
      <Menu
        anchorEl={storyboardMenuAnchor}
        open={Boolean(storyboardMenuAnchor)}
        onClose={() => setStoryboardMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setStoryboardMenuAnchor(null); setCreateDialogOpen(true); }}>
          <ListItemIcon><Add fontSize="small" /></ListItemIcon>
          <ListItemText>New Storyboard</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon><FolderOpen fontSize="small" /></ListItemIcon>
          <ListItemText>Open Storyboard</ListItemText>
        </MenuItem>
        <MenuItem disabled={!currentStoryboard}>
          <ListItemIcon><Save fontSize="small" /></ListItemIcon>
          <ListItemText>Save to Cloud</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        {currentStoryboard && (
          <>
            <Divider />
            <MenuItem
              onClick={() => {
                setStoryboardMenuAnchor(null);
                deleteStoryboard(currentStoryboard.id);
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Delete Storyboard</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Frame Editor / Annotation Dialog */}
      <Dialog
        open={Boolean(annotatingFrame)}
        onClose={() => setAnnotatingFrame(null)}
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: { bgcolor: '#0a0a12' }}}
      >
        {annotatingFrame && (
          <>
            <DialogTitle
              sx={{
                bgcolor: '#1a1a2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent:'space-between',
                py: 1}}
            >
              <Typography variant="h6">
                Annotate: {annotatingFrame.title}
              </Typography>
              <IconButton onClick={() => setAnnotatingFrame(null)} edge="end">
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              <FrameEditorPanel
                frame={annotatingFrame}
                onSave={(annotatedUrl) => {
                  // Update frame with annotated image
                  updateFrame(annotatingFrame.id, { imageUrl: annotatedUrl });
                  setAnnotatingFrame(null);
                }}
                onClose={() => setAnnotatingFrame(null)}
              />
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Animatic Player Dialog */}
      <AnimaticPlayerDialog
        open={animaticOpen}
        onClose={() => setAnimaticOpen(false)}
      />

      {/* Export Dialog */}
      <StoryboardExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
      />

      {/* Sharing Dialog */}
      {currentStoryboard && (
        <StoryboardSharingDialog
          open={sharingDialogOpen}
          onClose={() => setSharingDialogOpen(false)}
          storyboardId={currentStoryboard.id}
          storyboardName={currentStoryboard.name}
        />
      )}

      {/* Frame Context Menu */}
      <FrameContextMenu
        anchorPosition={contextMenuPosition}
        frame={contextMenuFrame}
        onClose={handleCloseContextMenu}
        onAnnotate={(frame) => setAnnotatingFrame(frame)}
        onQuickAnnotation={handleQuickAnnotation}
      />
    </Box>
  );
};

export default StoryboardPanel;

