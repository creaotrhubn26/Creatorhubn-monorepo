/**
 * LayersPanel - Multi-layer drawing management
 * 
 * Features:
 * - Multiple drawing layers
 * - Blend modes (normal, multiply, screen, overlay, etc.)
 * - Layer opacity
 * - Layer visibility toggle
 * - Layer reordering (drag & drop)
 * - Layer locking
 * - Merge layers
 * - Duplicate layers
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Slider,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Collapse,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Lock,
  LockOpen,
  Add,
  Delete,
  ContentCopy,
  MergeType,
  DragIndicator,
  MoreVert,
  KeyboardArrowUp,
  KeyboardArrowDown,
  Layers as LayersIcon,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { PencilStroke } from '../../hooks/useApplePencil';

// =============================================================================
// Types
// =============================================================================

export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  strokes: PencilStroke[];
  thumbnail?: string;
}

export interface LayersPanelProps {
  layers: DrawingLayer[];
  activeLayerId: string;
  onLayersChange: (layers: DrawingLayer[]) => void;
  onActiveLayerChange: (layerId: string) => void;
  onMergeLayers?: (layerIds: string[]) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// =============================================================================
// Styled Components
// =============================================================================

const PanelContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  minWidth: 220,
}));

const PanelHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});

const LayerItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'dragging',
})<{ active?: boolean; dragging?: boolean }>(({ active, dragging }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '6px 8px',
  gap: 8,
  cursor: 'pointer',
  backgroundColor: active ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
  borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
  opacity: dragging ? 0.5 : 1,
  transition: 'all 0.15s',
  '&:hover': {
    backgroundColor: active ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)',
  },
}));

const LayerThumbnail = styled(Box)({
  width: 32,
  height: 32,
  borderRadius: 4,
  backgroundColor: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  overflow: 'hidden',
  flexShrink: 0,
});

const LayerActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  gap: 4,
});

// =============================================================================
// Helper Functions
// =============================================================================

export function createLayer(name: string, id?: string): DrawingLayer {
  return {
    id: id || `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    strokes: [],
  };
}

export function getBlendModeLabel(mode: BlendMode): string {
  const labels: Record<BlendMode, string> = {
    'normal': 'Normal',
    'multiply': 'Multiply',
    'screen': 'Screen',
    'overlay': 'Overlay',
    'darken': 'Darken',
    'lighten': 'Lighten',
    'color-dodge': 'Color Dodge',
    'color-burn': 'Color Burn',
    'hard-light': 'Hard Light',
    'soft-light': 'Soft Light',
    'difference': 'Difference',
    'exclusion': 'Exclusion',
  };
  return labels[mode];
}

// =============================================================================
// Component
// =============================================================================

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  activeLayerId,
  onLayersChange,
  onActiveLayerChange,
  onMergeLayers,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;
  
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuLayerId, setMenuLayerId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const menuLayer = layers.find(l => l.id === menuLayerId);

  // Add new layer
  const handleAddLayer = useCallback(() => {
    const newLayer = createLayer(`Layer ${layers.length + 1}`);
    onLayersChange([newLayer, ...layers]);
    onActiveLayerChange(newLayer.id);
  }, [layers, onLayersChange, onActiveLayerChange]);

  // Delete layer
  const handleDeleteLayer = useCallback((layerId: string) => {
    if (layers.length <= 1) return; // Keep at least one layer
    const newLayers = layers.filter(l => l.id !== layerId);
    onLayersChange(newLayers);
    if (activeLayerId === layerId) {
      onActiveLayerChange(newLayers[0].id);
    }
    setMenuAnchor(null);
  }, [layers, activeLayerId, onLayersChange, onActiveLayerChange]);

  // Duplicate layer
  const handleDuplicateLayer = useCallback((layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const newLayer: DrawingLayer = {
      ...layer,
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: `${layer.name} Copy`,
      strokes: [...layer.strokes],
    };
    
    const index = layers.findIndex(l => l.id === layerId);
    const newLayers = [...layers];
    newLayers.splice(index, 0, newLayer);
    onLayersChange(newLayers);
    setMenuAnchor(null);
  }, [layers, onLayersChange]);

  // Toggle visibility
  const handleToggleVisibility = useCallback((layerId: string) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );
    onLayersChange(newLayers);
  }, [layers, onLayersChange]);

  // Toggle lock
  const handleToggleLock = useCallback((layerId: string) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, locked: !l.locked } : l
    );
    onLayersChange(newLayers);
  }, [layers, onLayersChange]);

  // Update opacity
  const handleOpacityChange = useCallback((layerId: string, opacity: number) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, opacity } : l
    );
    onLayersChange(newLayers);
  }, [layers, onLayersChange]);

  // Update blend mode
  const handleBlendModeChange = useCallback((layerId: string, blendMode: BlendMode) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, blendMode } : l
    );
    onLayersChange(newLayers);
  }, [layers, onLayersChange]);

  // Rename layer
  const handleRenameStart = useCallback((layer: DrawingLayer) => {
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
    setMenuAnchor(null);
  }, []);

  const handleRenameEnd = useCallback(() => {
    if (editingLayerId && editingName.trim()) {
      const newLayers = layers.map(l =>
        l.id === editingLayerId ? { ...l, name: editingName.trim() } : l
      );
      onLayersChange(newLayers);
    }
    setEditingLayerId(null);
    setEditingName('');
  }, [editingLayerId, editingName, layers, onLayersChange]);

  // Move layer
  const handleMoveLayer = useCallback((layerId: string, direction: 'up' | 'down') => {
    const index = layers.findIndex(l => l.id === layerId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= layers.length) return;
    
    const newLayers = [...layers];
    [newLayers[index], newLayers[newIndex]] = [newLayers[newIndex], newLayers[index]];
    onLayersChange(newLayers);
    setMenuAnchor(null);
  }, [layers, onLayersChange]);

  // Merge with layer below
  const handleMergeDown = useCallback((layerId: string) => {
    const index = layers.findIndex(l => l.id === layerId);
    if (index === -1 || index === layers.length - 1) return;
    
    const currentLayer = layers[index];
    const belowLayer = layers[index + 1];
    
    const mergedLayer: DrawingLayer = {
      ...belowLayer,
      strokes: [...belowLayer.strokes, ...currentLayer.strokes],
    };
    
    const newLayers = layers.filter((_, i) => i !== index);
    newLayers[index] = mergedLayer;
    
    onLayersChange(newLayers);
    onActiveLayerChange(mergedLayer.id);
    setMenuAnchor(null);
  }, [layers, onLayersChange, onActiveLayerChange]);

  // Drag handlers for reordering
  const handleDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault();
    if (!draggedLayerId || draggedLayerId === targetLayerId) {
      setDraggedLayerId(null);
      return;
    }
    
    const dragIndex = layers.findIndex(l => l.id === draggedLayerId);
    const dropIndex = layers.findIndex(l => l.id === targetLayerId);
    
    if (dragIndex === -1 || dropIndex === -1) {
      setDraggedLayerId(null);
      return;
    }
    
    const newLayers = [...layers];
    const [removed] = newLayers.splice(dragIndex, 1);
    newLayers.splice(dropIndex, 0, removed);
    
    onLayersChange(newLayers);
    setDraggedLayerId(null);
  }, [draggedLayerId, layers, onLayersChange]);

  return (
    <PanelContainer>
      {/* Header */}
      <PanelHeader onClick={() => setCollapsed(!collapsed)}>
        <Stack direction="row" alignItems="center" gap={1}>
          <LayersIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Layers
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            ({layers.length})
          </Typography>
        </Stack>
        {collapsed ? <ExpandMore sx={{ fontSize: 18 }} /> : <ExpandLess sx={{ fontSize: 18 }} />}
      </PanelHeader>

      <Collapse in={!collapsed}>
        {/* Active layer controls */}
        {activeLayer && (
          <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Stack spacing={1}>
              {/* Blend mode */}
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ fontSize: 12 }}>Blend</InputLabel>
                <Select
                  value={activeLayer.blendMode}
                  label="Blend"
                  onChange={(e) => handleBlendModeChange(activeLayer.id, e.target.value as BlendMode)}
                  sx={{ fontSize: 12 }}
                >
                  {(['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 
                    'color-dodge', 'color-burn', 'hard-light', 'soft-light', 
                    'difference', 'exclusion'] as BlendMode[]).map(mode => (
                    <MenuItem key={mode} value={mode} sx={{ fontSize: 12 }}>
                      {getBlendModeLabel(mode)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Opacity */}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Opacity: {Math.round(activeLayer.opacity * 100)}%
                </Typography>
                <Slider
                  size="small"
                  value={activeLayer.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(_, v) => handleOpacityChange(activeLayer.id, v as number)}
                />
              </Box>
            </Stack>
          </Box>
        )}

        {/* Layer list */}
        <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
          {layers.map((layer) => (
            <LayerItem
              key={layer.id}
              active={layer.id === activeLayerId}
              dragging={layer.id === draggedLayerId}
              onClick={() => onActiveLayerChange(layer.id)}
              draggable
              onDragStart={(e) => handleDragStart(e, layer.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, layer.id)}
              onDragEnd={() => setDraggedLayerId(null)}
            >
              {/* Drag handle */}
              <DragIndicator 
                sx={{ fontSize: 16, color: 'text.disabled', cursor: 'grab' }}
              />

              {/* Thumbnail */}
              <LayerThumbnail>
                {layer.thumbnail && (
                  <img 
                    src={layer.thumbnail} 
                    alt={layer.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </LayerThumbnail>

              {/* Name */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {editingLayerId === layer.id ? (
                  <TextField
                    size="small"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleRenameEnd}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameEnd()}
                    autoFocus
                    sx={{ 
                      '& input': { fontSize: 12, py: 0.5 },
                    }}
                  />
                ) : (
                  <Typography 
                    variant="body2" 
                    noWrap
                    sx={{ 
                      opacity: layer.visible ? 1 : 0.5,
                      fontSize: 12,
                    }}
                    onDoubleClick={() => handleRenameStart(layer)}
                  >
                    {layer.name}
                  </Typography>
                )}
              </Box>

              {/* Quick actions */}
              <Stack direction="row" spacing={0}>
                <Tooltip title={layer.visible ? 'Hide' : 'Show'}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleToggleVisibility(layer.id); }}
                  >
                    {layer.visible ? (
                      <Visibility sx={{ fontSize: 16 }} />
                    ) : (
                      <VisibilityOff sx={{ fontSize: 16, opacity: 0.5 }} />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title={layer.locked ? 'Unlock' : 'Lock'}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleToggleLock(layer.id); }}
                  >
                    {layer.locked ? (
                      <Lock sx={{ fontSize: 16 }} />
                    ) : (
                      <LockOpen sx={{ fontSize: 16, opacity: 0.5 }} />
                    )}
                  </IconButton>
                </Tooltip>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAnchor(e.currentTarget);
                    setMenuLayerId(layer.id);
                  }}
                >
                  <MoreVert sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>
            </LayerItem>
          ))}
        </Box>

        {/* Actions */}
        <LayerActions>
          <Tooltip title="Add Layer">
            <IconButton size="small" onClick={handleAddLayer}>
              <Add sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Layer">
            <span>
              <IconButton 
                size="small" 
                onClick={() => handleDeleteLayer(activeLayerId)}
                disabled={layers.length <= 1}
              >
                <Delete sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Duplicate Layer">
            <IconButton size="small" onClick={() => handleDuplicateLayer(activeLayerId)}>
              <ContentCopy sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Merge Down">
            <span>
              <IconButton 
                size="small" 
                onClick={() => handleMergeDown(activeLayerId)}
                disabled={layers.findIndex(l => l.id === activeLayerId) === layers.length - 1}
              >
                <MergeType sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </LayerActions>
      </Collapse>

      {/* Layer menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: { 
              bgcolor: 'rgba(30,30,40,0.95)', 
              backdropFilter: 'blur(8px)',
              minWidth: 160,
            }
          }
        }}
      >
        {menuLayer && (
          <>
            <MenuItem onClick={() => handleRenameStart(menuLayer)} sx={{ fontSize: 13 }}>
              Rename
            </MenuItem>
            <MenuItem onClick={() => handleDuplicateLayer(menuLayer.id)} sx={{ fontSize: 13 }}>
              Duplicate
            </MenuItem>
            <Divider />
            <MenuItem 
              onClick={() => handleMoveLayer(menuLayer.id, 'up')}
              disabled={layers.indexOf(menuLayer) === 0}
              sx={{ fontSize: 13 }}
            >
              <KeyboardArrowUp sx={{ fontSize: 16, mr: 1 }} /> Move Up
            </MenuItem>
            <MenuItem 
              onClick={() => handleMoveLayer(menuLayer.id, 'down')}
              disabled={layers.indexOf(menuLayer) === layers.length - 1}
              sx={{ fontSize: 13 }}
            >
              <KeyboardArrowDown sx={{ fontSize: 16, mr: 1 }} /> Move Down
            </MenuItem>
            <Divider />
            <MenuItem 
              onClick={() => handleMergeDown(menuLayer.id)}
              disabled={layers.indexOf(menuLayer) === layers.length - 1}
              sx={{ fontSize: 13 }}
            >
              <MergeType sx={{ fontSize: 16, mr: 1 }} /> Merge Down
            </MenuItem>
            <Divider />
            <MenuItem 
              onClick={() => handleDeleteLayer(menuLayer.id)}
              disabled={layers.length <= 1}
              sx={{ fontSize: 13, color: 'error.main' }}
            >
              <Delete sx={{ fontSize: 16, mr: 1 }} /> Delete
            </MenuItem>
          </>
        )}
      </Menu>
    </PanelContainer>
  );
};

export default LayersPanel;
