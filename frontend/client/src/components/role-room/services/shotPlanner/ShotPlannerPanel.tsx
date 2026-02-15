/**
 * Shot Planner Panel - Main 2D Shot Planning Interface
 * 
 * Professional visual shot planning tool combining:
 * - Interactive 2D canvas with camera frustums
 * - Asset library for props, actors, furniture
 * - Shot list management
 * - Camera settings panel
 * - Toolbar for tools and viewport controls
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Menu,
  MenuItem,
  Slider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Stack,
  useTheme,
  useMediaQuery,
  Fade,
  Zoom,
} from '@mui/material';
import {
  PanTool as PanIcon,
  Mouse as SelectIcon,
  Videocam as CameraIcon,
  Person as ActorIcon,
  Chair as PropIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitIcon,
  GridOn as GridIcon,
  Straighten as RulerIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Save as SaveIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Visibility as ShowIcon,
  VisibilityOff as HideIcon,
  Settings as SettingsIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Timeline as TimelineIcon,
  ViewSidebar as SidebarIcon,
  MoreVert as MoreIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  SelectAll as SelectAllIcon,
  CenterFocusStrong as CenterIcon,
  PhotoCamera as SnapshotIcon,
  HelpOutline as HelpIcon,
  Keyboard as KeyboardIcon,
  Map as MapIcon,
  Layers as LayersIcon,
  Speed as SpeedIcon,
  MyLocation as MyLocationIcon,
  GridView as GridViewIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as NextShotIcon,
  SkipPrevious as PrevShotIcon,
  AutoAwesome as MagicIcon,
  Close as CloseIcon,
  Dashboard as TemplateIcon,
  CameraRoll as PresetIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useShotPlannerStore, useCurrentScene, useActiveTool, useSelection } from './store';
import { ShotPlannerCanvas } from './ShotPlannerCanvas';
import { ShotListSidebar } from './ShotListSidebar';
import { CameraSettingsPanel } from './CameraSettingsPanel';
import { AssetLibraryPanel } from './AssetLibraryPanel';
import { GuidesPanel } from './GuidesPanel';
import { FramingGuideRenderer } from './FramingGuideRenderer';
import { FloorPlanUpload } from './FloorPlanUpload';
import { PencilCanvasPro } from '../../components/PencilCanvasPro';
import { PencilStroke } from '../../hooks/useApplePencil';
import { SCENE_TEMPLATES } from './demoScenes';
import { PlannerTool } from './types';

// =============================================================================
// Toolbar Tools Configuration
// =============================================================================

const TOOLS: { id: PlannerTool; label: string; icon: React.ReactElement; shortcut: string }[] = [
  { id: 'select', label: 'Select', icon: <SelectIcon />, shortcut: 'V' },
  { id: 'pan', label: 'Pan', icon: <PanIcon />, shortcut: 'H' },
  { id: 'camera', label: 'Add Camera', icon: <CameraIcon />, shortcut: 'C' },
  { id: 'actor', label: 'Add Actor', icon: <ActorIcon />, shortcut: 'A' },
  { id: 'prop', label: 'Add Prop', icon: <PropIcon />, shortcut: 'P' },
  { id: 'measure', label: 'Measure', icon: <RulerIcon />, shortcut: 'M' },
];

// =============================================================================
// Keyboard Shortcuts
// =============================================================================

const KEYBOARD_SHORTCUTS = [
  { category: 'Tools', shortcuts: [
    { key: 'V', action: 'Select Tool' },
    { key: 'H', action: 'Pan/Hand Tool' },
    { key: 'C', action: 'Add Camera' },
    { key: 'A', action: 'Add Actor' },
    { key: 'P', action: 'Add Prop' },
  ]},
  { category: 'View', shortcuts: [
    { key: '+/=', action: 'Zoom In' },
    { key: '-', action: 'Zoom Out' },
    { key: '0', action: 'Reset View' },
    { key: '1', action: 'Fit to Content' },
    { key: 'G', action: 'Toggle Grid' },
  ]},
  { category: 'Panels', shortcuts: [
    { key: 'Shift+L', action: 'Toggle Shot List' },
    { key: 'Shift+R', action: 'Toggle Camera Settings' },
    { key: 'Shift+B', action: 'Toggle Asset Library' },
  ]},
  { category: 'Edit', shortcuts: [
    { key: 'Cmd+Z', action: 'Undo' },
    { key: 'Cmd+Shift+Z', action: 'Redo' },
    { key: 'Cmd+C', action: 'Copy' },
    { key: 'Cmd+V', action: 'Paste' },
    { key: 'Delete', action: 'Delete Selected' },
  ]},
];

// =============================================================================
// Glass Panel Styles
// =============================================================================

const glassStyles = {
  background: 'rgba(30, 45, 61, 0.85)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

const glassHoverStyles = {
  background: 'rgba(40, 55, 71, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
};

// =============================================================================
// New Scene Dialog
// =============================================================================

interface NewSceneDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, location: string) => void;
}

const NewSceneDialog: React.FC<NewSceneDialogProps> = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  
  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name.trim(), location.trim());
      setName('');
      setLocation('');
      onClose();
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Scene</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Scene Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Scene 12: The Safehouse"
          sx={{ mt: 1, mb: 2 }}
        />
        <TextField
          fullWidth
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., INT. SAFEHOUSE - NIGHT"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!name.trim()}
        >
          Create Scene
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// =============================================================================
// Main Component
// =============================================================================

interface ShotPlannerPanelProps {
  onClose?: () => void;
}

export const ShotPlannerPanel: React.FC<ShotPlannerPanelProps> = ({ onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Store
  const scene = useCurrentScene();
  const activeTool = useActiveTool();
  const selection = useSelection();
  const {
    createScene,
    loadDemoScene,
    setActiveTool,
    zoomIn,
    zoomOut,
    resetViewport,
    fitToContent,
    updateScene,
    undo,
    redo,
    copy,
    paste,
    selectAll,
    deleteSelected,
    exportScene,
    exportAsPDF,
    exportShotCallsheet,
    toggleAssetLibrary,
    toggleCameraSettings,
    toggleShotList,
    showAssetLibrary,
    showCameraSettings,
    showShotList,
    syncScenes,
  } = useShotPlannerStore();
  
  // Local state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newSceneDialogOpen, setNewSceneDialogOpen] = useState(false);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [fabExpanded, setFabExpanded] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [showFramingGuides, setShowFramingGuides] = useState(false);
  const [showFloorPlanUpload, setShowFloorPlanUpload] = useState(false);
  const [annotationStrokes, setAnnotationStrokes] = useState<PencilStroke[]>([]);
  const [shotPlannerSnapshot, setShotPlannerSnapshot] = useState<string | undefined>(undefined);
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Account for sidebars
        let width = rect.width;
        if (showShotList) width -= 280;
        if (showCameraSettings) width -= 300;
        if (showAssetLibrary) width -= 250;
        
        setCanvasSize({
          width: Math.max(400, width),
          height: Math.max(400, rect.height - 60), // Minus toolbar
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [showShotList, showCameraSettings, showAssetLibrary]);
  
  // Track viewport size for annotation canvas
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const key = e.key.toLowerCase();
      
      // Tool shortcuts
      if (key === 'v') setActiveTool('select');
      else if (key === 'h') setActiveTool('pan');
      else if (key === 'c' && !e.metaKey && !e.ctrlKey) setActiveTool('camera');
      else if (key === 'a' && !e.metaKey && !e.ctrlKey) setActiveTool('actor');
      else if (key === 'p') setActiveTool('prop');
      
      // Viewport shortcuts
      else if (key === '=' || key === '+') zoomIn();
      else if (key === '-') zoomOut();
      else if (key === '0') resetViewport();
      else if (key === '1') fitToContent();
      
      // Toggle panels
      else if (key === 'l' && e.shiftKey) toggleShotList();
      else if (key === 'r' && e.shiftKey) toggleCameraSettings();
      else if (key === 'b' && e.shiftKey) toggleAssetLibrary();
      
      // Grid toggle
      else if (key === 'g' && !e.metaKey && !e.ctrlKey) {
        if (scene) {
          updateScene({ showGrid: !scene.showGrid });
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scene, setActiveTool, zoomIn, zoomOut, resetViewport, fitToContent, toggleShotList, toggleCameraSettings, toggleAssetLibrary, updateScene]);
  
  // Create new scene if none exists
  useEffect(() => {
    if (!scene) {
      setShowTemplates(true);
    }
  }, [scene]);
  
  // Sync scenes from database on mount
  useEffect(() => {
    syncScenes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  const handleCreateScene = (name: string, location: string) => {
    createScene(name, location);
    setNewSceneDialogOpen(false);
  };
  
  // Load existing annotations and capture canvas when entering annotation mode
  useEffect(() => {
    if (annotationMode) {
      // Convert scene annotations back to PencilStrokes
      if (scene?.annotations && scene.annotations.length > 0) {
        const convertedStrokes: PencilStroke[] = scene.annotations.flatMap(annotation => 
          annotation.strokes.map(stroke => ({
            points: stroke.x.map((x, i) => ({
              x,
              y: stroke.y[i],
              pressure: stroke.pressure[i],
              tiltX: stroke.tilt?.[i]?.x || 0,
              tiltY: stroke.tilt?.[i]?.y || 0,
              timestamp: annotation.timestamp + i,
            })),
            inputType: 'pen' as const,
            color: stroke.color,
            width: stroke.size,
            opacity: 1,
          }))
        );
        setAnnotationStrokes(convertedStrokes);
      } else {
        setAnnotationStrokes([]);
      }
      
      // Capture current shot planner canvas as background
      if (canvasRef.current) {
        const canvas = canvasRef.current.querySelector('canvas');
        if (canvas) {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            setShotPlannerSnapshot(dataUrl);
          } catch (err) {
            console.warn('Could not capture shot planner canvas:', err);
            setShotPlannerSnapshot(undefined);
          }
        }
      }
    } else {
      // Clear snapshot when exiting annotation mode
      setShotPlannerSnapshot(undefined);
    }
  }, [annotationMode, scene]);
  
  const handleAnnotationSave = () => {
    // Strokes are already saved via handleAnnotationStrokesChange
    setAnnotationMode(false);
  };
  
  const handleAnnotationStrokesChange = (strokes: PencilStroke[]) => {
    setAnnotationStrokes(strokes);
    // Convert PencilStrokes to scene annotations format for persistence
    if (scene) {
      const annotations = strokes.map((stroke, index) => ({
        id: `annotation-${Date.now()}-${index}`,
        strokes: [{
          x: stroke.points.map(p => p.x),
          y: stroke.points.map(p => p.y),
          pressure: stroke.points.map(p => p.pressure),
          tilt: stroke.points.map(p => ({ x: p.tiltX || 0, y: p.tiltY || 0 })),
          brushType: 'pencil', // Default brush type
          color: stroke.color,
          size: stroke.width,
        }],
        timestamp: stroke.points[0]?.timestamp || Date.now(),
      }));
      updateScene({ annotations });
    }
  };
  
  const handleExport = () => {
    const json = exportScene();
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scene?.name || 'scene'}-shot-plan.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Track mouse position on canvas
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / (scene?.viewport.zoom || 1)).toFixed(0);
      const y = ((e.clientY - rect.top) / (scene?.viewport.zoom || 1)).toFixed(0);
      setMousePosition({ x: Number(x), y: Number(y) });
    }
  }, [scene?.viewport.zoom]);

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0A1929 0%, #0D2137 50%, #0A1929 100%)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Modern Glass Toolbar */}
      <Box
        component={motion.div}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          mx: 2,
          mt: 1.5,
          borderRadius: 3,
          ...glassStyles,
          zIndex: 10,
        }}
      >
        {/* Left: Title & Scene Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(79, 195, 247, 0.4)',
              }}
            >
              <CameraIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Shot Planner
            </Typography>
          </Box>
          {scene && (
            <Chip
              label={scene.name}
              size="small"
              sx={{
                backgroundColor: 'rgba(79, 195, 247, 0.15)',
                color: '#4FC3F7',
                border: '1px solid rgba(79, 195, 247, 0.3)',
                fontWeight: 500,
                '& .MuiChip-label': { px: 1.5 },
              }}
            />
          )}
        </Box>
        
        {/* Center: Tool Buttons with Glass Pills */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Navigation Tools */}
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              p: 0.5,
              borderRadius: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            {TOOLS.slice(0, 2).map(tool => (
              <Tooltip key={tool.id} title={`${tool.label} (${tool.shortcut})`} placement="bottom">
                <IconButton
                  size="small"
                  onClick={() => setActiveTool(tool.id)}
                  sx={{
                    color: activeTool === tool.id ? '#fff' : '#8896A6',
                    backgroundColor: activeTool === tool.id ? '#4FC3F7' : 'transparent',
                    borderRadius: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: activeTool === tool.id ? '#29B6F6' : 'rgba(255,255,255,0.1)',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  {tool.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>
          
          {/* Create Tools */}
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              p: 0.5,
              borderRadius: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            {TOOLS.slice(2).map(tool => (
              <Tooltip key={tool.id} title={`${tool.label} (${tool.shortcut})`} placement="bottom">
                <IconButton
                  size="small"
                  onClick={() => setActiveTool(tool.id)}
                  sx={{
                    color: activeTool === tool.id ? '#fff' : '#8896A6',
                    backgroundColor: activeTool === tool.id ? '#4FC3F7' : 'transparent',
                    borderRadius: 1.5,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: activeTool === tool.id ? '#29B6F6' : 'rgba(255,255,255,0.1)',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  {tool.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.1)' }} />
          
          {/* View Controls */}
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              p: 0.5,
              borderRadius: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <Tooltip title="Toggle Grid (G)">
              <IconButton
                size="small"
                onClick={() => scene && updateScene({ showGrid: !scene.showGrid })}
                sx={{
                  color: scene?.showGrid ? '#4FC3F7' : '#8896A6',
                  borderRadius: 1.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <GridIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Toggle 180° Line">
              <IconButton
                size="small"
                onClick={() => scene && updateScene({ show180Line: !scene.show180Line })}
                sx={{
                  color: scene?.show180Line ? '#4FC3F7' : '#8896A6',
                  borderRadius: 1.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <RulerIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Toggle Mini Map">
              <IconButton
                size="small"
                onClick={() => setShowMiniMap(!showMiniMap)}
                sx={{
                  color: showMiniMap ? '#4FC3F7' : '#8896A6',
                  borderRadius: 1.5,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                }}
              >
                <MapIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Right: Zoom & Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Zoom Control Pill */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 2,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <IconButton size="small" onClick={zoomOut} sx={{ color: '#8896A6', p: 0.5 }}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
            <Box
              sx={{
                minWidth: 50,
                textAlign: 'center',
                px: 1,
                py: 0.25,
                borderRadius: 1,
                backgroundColor: 'rgba(79, 195, 247, 0.15)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#4FC3F7', fontWeight: 600 }}>
                {scene ? `${Math.round(scene.viewport.zoom * 100)}%` : '100%'}
              </Typography>
            </Box>
            <IconButton size="small" onClick={zoomIn} sx={{ color: '#8896A6', p: 0.5 }}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
            <Tooltip title="Fit to Content (1)">
              <IconButton size="small" onClick={fitToContent} sx={{ color: '#8896A6', p: 0.5 }}>
                <FitIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          
          {/* History */}
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title="Undo (Cmd+Z)">
              <IconButton size="small" onClick={undo} sx={{ color: '#8896A6' }}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Redo (Cmd+Shift+Z)">
              <IconButton size="small" onClick={redo} sx={{ color: '#8896A6' }}>
                <RedoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(255,255,255,0.1)' }} />
          
          {/* Panel Toggles */}
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title="Shot List (Shift+L)">
              <IconButton
                size="small"
                onClick={toggleShotList}
                sx={{ color: showShotList ? '#4FC3F7' : '#8896A6' }}
              >
                <SidebarIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Asset Library (Shift+B)">
              <IconButton
                size="small"
                onClick={toggleAssetLibrary}
                sx={{ color: showAssetLibrary ? '#4FC3F7' : '#8896A6' }}
              >
                <PropIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Keyboard Shortcuts">
              <IconButton
                size="small"
                onClick={() => setShowShortcuts(true)}
                sx={{ color: '#8896A6' }}
              >
                <KeyboardIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          
          {/* More Options */}
          <Tooltip title="More Options">
            <IconButton
              size="small"
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
            >
              <MoreIcon sx={{ color: '#8896A6' }} />
            </IconButton>
          </Tooltip>
          
          <Menu
            anchorEl={moreMenuAnchor}
            open={Boolean(moreMenuAnchor)}
            onClose={() => setMoreMenuAnchor(null)}
            PaperProps={{ sx: { ...glassStyles, borderRadius: 2 } }}
          >
            <MenuItem onClick={() => { setAnnotationMode(true); setMoreMenuAnchor(null); }}>
              ✏️ Annotate (Pro Drawing)
            </MenuItem>
            <MenuItem onClick={() => { setShowFramingGuides(!showFramingGuides); setMoreMenuAnchor(null); }}>
              📐 Framing Guides {showFramingGuides ? '✓' : ''}
            </MenuItem>
            <MenuItem onClick={() => { setShowFloorPlanUpload(true); setMoreMenuAnchor(null); }}>
              🏗️ Floor Plan
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setNewSceneDialogOpen(true); setMoreMenuAnchor(null); }}>
              <AddIcon sx={{ mr: 1 }} /> New Scene
            </MenuItem>
            <MenuItem onClick={() => { handleExport(); setMoreMenuAnchor(null); }}>
              <ExportIcon sx={{ mr: 1 }} /> Export Scene (JSON)
            </MenuItem>
            <MenuItem 
              onClick={async () => { 
                await exportAsPDF(`${scene?.name || 'scene'}-shot-plan.pdf`);
                setMoreMenuAnchor(null); 
              }}
            >
              <ExportIcon sx={{ mr: 1 }} /> Export PDF
            </MenuItem>
            <MenuItem 
              onClick={async () => { 
                const blob = await exportShotCallsheet('csv');
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${scene?.name || 'scene'}-callsheet.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
                setMoreMenuAnchor(null); 
              }}
            >
              <ExportIcon sx={{ mr: 1 }} /> Export Callsheet (CSV)
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <MenuItem onClick={() => { handleToggleFullscreen(); setMoreMenuAnchor(null); }}>
              {isFullscreen ? <FullscreenExitIcon sx={{ mr: 1 }} /> : <FullscreenIcon sx={{ mr: 1 }} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
            <MenuItem onClick={() => { setShowShortcuts(true); setMoreMenuAnchor(null); }}>
              <KeyboardIcon sx={{ mr: 1 }} /> Keyboard Shortcuts
            </MenuItem>
          </Menu>
          
          <Tooltip title="Fullscreen">
            <IconButton size="small" onClick={handleToggleFullscreen}>
              {isFullscreen ? (
                <FullscreenExitIcon sx={{ color: '#8896A6' }} />
              ) : (
                <FullscreenIcon sx={{ color: '#8896A6' }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Shot List */}
        <AnimatePresence>
          {showShotList && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <Box sx={{ width: 280, height: '100%', p: 1 }}>
                <ShotListSidebar />
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Center - Canvas */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Asset Library (Bottom overlay) */}
          <AnimatePresence>
            {showAssetLibrary && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 250, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 5,
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ height: 250, p: 1 }}>
                  <AssetLibraryPanel />
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Canvas */}
          <Box
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 1,
              pb: showAssetLibrary ? '260px' : 1,
              position: 'relative',
            }}
          >
            {scene ? (
              <>
                <ShotPlannerCanvas
                  width={canvasSize.width}
                  height={showAssetLibrary ? canvasSize.height - 250 : canvasSize.height}
                />
                
                {/* Mini Map */}
                <AnimatePresence>
                  {showMiniMap && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      style={{
                        position: 'absolute',
                        bottom: showAssetLibrary ? 270 : 16,
                        right: 16,
                      }}
                    >
                      <Paper
                        sx={{
                          width: 160,
                          height: 120,
                          ...glassStyles,
                          borderRadius: 2,
                          overflow: 'hidden',
                          p: 0.5,
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: 1.5,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="caption" sx={{ color: '#8896A6', opacity: 0.7 }}>
                            Mini Map
                          </Typography>
                          {/* Viewport indicator */}
                          <Box
                            sx={{
                              position: 'absolute',
                              border: '2px solid #4FC3F7',
                              borderRadius: 0.5,
                              width: `${100 / (scene.viewport.zoom || 1)}%`,
                              height: `${100 / (scene.viewport.zoom || 1)}%`,
                              maxWidth: '90%',
                              maxHeight: '90%',
                              backgroundColor: 'rgba(79, 195, 247, 0.1)',
                            }}
                          />
                        </Box>
                      </Paper>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              /* Enhanced Empty State */
              <Box
                component={motion.div}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  maxWidth: 500,
                }}
              >
                {/* Animated Icon */}
                <Box
                  component={motion.div}
                  animate={{ 
                    y: [0, -8, 0],
                    rotateZ: [0, 5, -5, 0],
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  sx={{
                    width: 120,
                    height: 120,
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, rgba(79, 195, 247, 0.2) 0%, rgba(79, 195, 247, 0.05) 100%)',
                    border: '2px dashed rgba(79, 195, 247, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                  }}
                >
                  <CameraIcon sx={{ fontSize: 56, color: '#4FC3F7', opacity: 0.8 }} />
                </Box>
                
                <Typography variant="h5" sx={{ color: '#FFFFFF', fontWeight: 600, mb: 1 }}>
                  Start Your Shot Plan
                </Typography>
                <Typography variant="body2" sx={{ color: '#8896A6', mb: 3, maxWidth: 350 }}>
                  Create camera setups, position actors, and plan your shots with our professional 2D planning tool.
                </Typography>
                
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setNewSceneDialogOpen(true)}
                    sx={{
                      background: 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)',
                      boxShadow: '0 4px 16px rgba(79, 195, 247, 0.4)',
                      px: 3,
                      py: 1,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #29B6F6 0%, #0288D1 100%)',
                        boxShadow: '0 6px 20px rgba(79, 195, 247, 0.5)',
                      },
                    }}
                  >
                    Create New Scene
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<TemplateIcon />}
                    onClick={() => setShowTemplates(true)}
                    sx={{
                      borderColor: 'rgba(79, 195, 247, 0.4)',
                      color: '#4FC3F7',
                      '&:hover': {
                        borderColor: '#4FC3F7',
                        backgroundColor: 'rgba(79, 195, 247, 0.1)',
                      },
                    }}
                  >
                    Use Template
                  </Button>
                </Stack>
                
                {/* Quick tip */}
                <Box
                  sx={{
                    mt: 4,
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid rgba(255, 193, 7, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <MagicIcon sx={{ color: '#FFC107', fontSize: 20 }} />
                  <Typography variant="caption" sx={{ color: '#FFC107' }}>
                    Pro tip: Press <Chip label="?" size="small" sx={{ mx: 0.5, height: 20, backgroundColor: 'rgba(255,193,7,0.2)', color: '#FFC107' }} /> to view keyboard shortcuts
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
          
          {/* Floating Action Button */}
          <AnimatePresence>
            {scene && (
              <Box
                component={motion.div}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                sx={{
                  position: 'absolute',
                  bottom: showAssetLibrary ? 280 : 24,
                  left: 24,
                  zIndex: 100,
                }}
              >
                <Box sx={{ position: 'relative' }}>
                  {/* Expanded FAB options */}
                  <AnimatePresence>
                    {fabExpanded && (
                      <Stack
                        component={motion.div}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        spacing={1}
                        sx={{ position: 'absolute', bottom: 60, left: 0 }}
                      >
                        {[
                          { icon: <CameraIcon />, label: 'Add Camera', action: () => setActiveTool('camera') },
                          { icon: <ActorIcon />, label: 'Add Actor', action: () => setActiveTool('actor') },
                          { icon: <PropIcon />, label: 'Add Prop', action: () => setActiveTool('prop') },
                          { icon: <ExportIcon />, label: 'Export', action: handleExport },
                        ].map((item, i) => (
                          <Tooltip key={i} title={item.label} placement="right">
                            <IconButton
                              component={motion.button}
                              initial={{ scale: 0, x: -20 }}
                              animate={{ scale: 1, x: 0, transition: { delay: i * 0.05 } }}
                              onClick={() => { item.action(); setFabExpanded(false); }}
                              sx={{
                                width: 44,
                                height: 44,
                                ...glassStyles,
                                color: '#fff',
                                '&:hover': glassHoverStyles,
                              }}
                            >
                              {item.icon}
                            </IconButton>
                          </Tooltip>
                        ))}
                      </Stack>
                    )}
                  </AnimatePresence>
                  
                  {/* Main FAB */}
                  <IconButton
                    component={motion.button}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFabExpanded(!fabExpanded)}
                    sx={{
                      width: 52,
                      height: 52,
                      background: fabExpanded 
                        ? 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)'
                        : 'linear-gradient(135deg, #4FC3F7 0%, #29B6F6 100%)',
                      boxShadow: fabExpanded
                        ? '0 4px 20px rgba(244, 67, 54, 0.4)'
                        : '0 4px 20px rgba(79, 195, 247, 0.4)',
                      color: '#fff',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: fabExpanded
                          ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'
                          : 'linear-gradient(135deg, #29B6F6 0%, #0288D1 100%)',
                      },
                    }}
                  >
                    <motion.div
                      animate={{ rotate: fabExpanded ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <AddIcon />
                    </motion.div>
                  </IconButton>
                </Box>
              </Box>
            )}
          </AnimatePresence>
        </Box>
        
        {/* Right Sidebar - Camera Settings & Guides */}
        <AnimatePresence>
          {showCameraSettings && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <Box
                sx={{
                  width: 320,
                  height: '100%',
                  p: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  overflowY: 'auto',
                }}
              >
                <CameraSettingsPanel />
                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />
                <GuidesPanel />
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
      
      {/* New Scene Dialog */}
      <NewSceneDialog
        open={newSceneDialogOpen}
        onClose={() => setNewSceneDialogOpen(false)}
        onCreate={handleCreateScene}
      />
      
      {/* Keyboard Shortcuts Dialog */}
      <Dialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        maxWidth="md"
        PaperProps={{
          sx: {
            ...glassStyles,
            borderRadius: 3,
            minWidth: 600,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <KeyboardIcon sx={{ color: '#4FC3F7' }} />
            Keyboard Shortcuts
          </Box>
          <IconButton onClick={() => setShowShortcuts(false)} sx={{ color: '#8896A6' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
            {KEYBOARD_SHORTCUTS.map((category) => (
              <Box key={category.category}>
                <Typography variant="subtitle2" sx={{ color: '#4FC3F7', mb: 1.5, fontWeight: 600 }}>
                  {category.category}
                </Typography>
                <Stack spacing={1}>
                  {category.shortcuts.map((shortcut) => (
                    <Box
                      key={shortcut.key}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 1,
                        borderRadius: 1,
                        backgroundColor: 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: '#fff' }}>
                        {shortcut.action}
                      </Typography>
                      <Chip
                        label={shortcut.key}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(79, 195, 247, 0.15)',
                          color: '#4FC3F7',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
      
      {/* Scene Templates Dialog */}
      <Dialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            ...glassStyles,
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ color: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <TemplateIcon sx={{ color: '#4FC3F7' }} />
            Scene Templates
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            {SCENE_TEMPLATES.map((template) => (
              <Paper
                key={template.id}
                onClick={() => {
                  const scene = template.create();
                  loadDemoScene(scene);
                  setShowTemplates(false);
                }}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 2,
                  border: '1px solid transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(79, 195, 247, 0.1)',
                    border: '1px solid rgba(79, 195, 247, 0.3)',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(79, 195, 247, 0.2)',
                      borderRadius: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Typography variant="h6" sx={{ color: '#4FC3F7' }}>
                      {template.id[0].toUpperCase()}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                      {template.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#8896A6' }}>
                      {template.description}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
      
      {/* Status Bar */}
      <Box
        component={motion.div}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.75,
          mx: 2,
          mb: 1.5,
          borderRadius: 2,
          ...glassStyles,
          fontSize: 12,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MyLocationIcon sx={{ fontSize: 14, color: '#8896A6' }} />
            <Typography variant="caption" sx={{ color: '#8896A6' }}>
              X: <span style={{ color: '#4FC3F7', fontFamily: 'monospace' }}>{mousePosition.x}</span>
              {' '}Y: <span style={{ color: '#4FC3F7', fontFamily: 'monospace' }}>{mousePosition.y}</span>
            </Typography>
          </Box>
          {scene && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CameraIcon sx={{ fontSize: 14, color: '#8896A6' }} />
                <Typography variant="caption" sx={{ color: '#8896A6' }}>
                  <span style={{ color: '#4FC3F7' }}>{scene.cameras.length}</span> cameras
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ActorIcon sx={{ fontSize: 14, color: '#8896A6' }} />
                <Typography variant="caption" sx={{ color: '#8896A6' }}>
                  <span style={{ color: '#4FC3F7' }}>{scene.actors.length}</span> actors
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PropIcon sx={{ fontSize: 14, color: '#8896A6' }} />
                <Typography variant="caption" sx={{ color: '#8896A6' }}>
                  <span style={{ color: '#4FC3F7' }}>{scene.props.length}</span> props
                </Typography>
              </Box>
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: '#8896A6' }}>
            Grid: <span style={{ color: scene?.showGrid ? '#4FC3F7' : '#666' }}>{scene?.showGrid ? 'ON' : 'OFF'}</span>
          </Typography>
          <Typography variant="caption" sx={{ color: '#8896A6' }}>
            Tool: <span style={{ color: '#4FC3F7', textTransform: 'capitalize' }}>{activeTool}</span>
          </Typography>
          <Tooltip title="Press ? for shortcuts">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                '&:hover': { opacity: 0.8 },
              }}
              onClick={() => setShowShortcuts(true)}
            >
              <KeyboardIcon sx={{ fontSize: 14, color: '#8896A6' }} />
              <Typography variant="caption" sx={{ color: '#8896A6' }}>?</Typography>
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* Professional Annotation Layer */}
      {annotationMode && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 9999,
            bgcolor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header with close button */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              bgcolor: '#1a1a2e',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Typography variant="h6" sx={{ color: '#fff' }}>
              Shot Plan Annotations
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleAnnotationSave}
                sx={{
                  bgcolor: '#4FC3F7',
                  '&:hover': { bgcolor: '#29B6F6' },
                }}
              >
                Done
              </Button>
              <IconButton
                onClick={() => setAnnotationMode(false)}
                sx={{ color: '#fff' }}
              >
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>
          
          {/* PencilCanvasPro */}
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <PencilCanvasPro
              width={viewportSize.width}
              height={viewportSize.height - 64}
              backgroundImage={shotPlannerSnapshot}
              initialStrokes={annotationStrokes}
              showToolbar={true}
              showPressureIndicator={true}
              showDrawingToolsPanel={true}
              drawingToolsPanelPosition="left"
              palmRejection="smart"
              onStrokesChange={handleAnnotationStrokesChange}
              onSave={handleAnnotationSave}
            />
          </Box>
        </Box>
      )}

      {/* Framing Guides Overlay */}
      <AnimatePresence>
        {showFramingGuides && scene && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            <FramingGuideRenderer
              canvas={canvasRef.current?.querySelector('canvas') || null}
              width={canvasSize.width}
              height={canvasSize.height}
              guides={scene.shots
                .find(s => s.id === scene.activeShotId)
                ?.framingGuide
                ? [scene.shots.find(s => s.id === scene.activeShotId)!.framingGuide]
                : []}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floor Plan Upload Dialog */}
      <AnimatePresence>
        {showFloorPlanUpload && scene && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1001,
            }}
          >
            <Paper
              sx={{
                width: 450,
                maxWidth: '90vw',
                bgcolor: '#1a1a2e',
                color: '#fff',
                p: 3,
                borderRadius: 2,
                border: '1px solid rgba(79, 195, 247, 0.3)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Floor Plan</Typography>
                <IconButton onClick={() => setShowFloorPlanUpload(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <FloorPlanUpload
                currentImageUrl={scene.floorPlan.imageUrl}
                scale={scene.floorPlan.scale}
                onUpload={async (imageUrl, scale) => {
                  updateScene({
                    floorPlan: {
                      ...scene.floorPlan,
                      imageUrl,
                      scale,
                    },
                  });
                  setShowFloorPlanUpload(false);
                }}
                onDelete={() => {
                  updateScene({
                    floorPlan: {
                      ...scene.floorPlan,
                      imageUrl: undefined,
                    },
                  });
                }}
                glassStyles={{}}
              />
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default ShotPlannerPanel;
