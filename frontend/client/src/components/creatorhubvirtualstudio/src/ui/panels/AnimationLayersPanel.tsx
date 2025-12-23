/**
 * AnimationLayersPanel - Layer-based animation management
 * 
 * Features:
 * - Layer stack visualization
 * - Drag-and-drop reordering
 * - Weight/blend mode controls
 * - Solo/mute toggles
 * - Layer masking
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Menu,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Delete,
  Layers,
  LayersClear,
  VolumeUp,
  VolumeOff,
  Star,
  StarBorder,
  DragIndicator,
  MoreVert,
  ContentCopy,
  Edit,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  ExpandMore,
  ExpandLess,
  Animation,
} from '@mui/icons-material';
import {
  animationBlendingService,
  AnimationLayer,
  BlendMode,
  CAMERA_ANIMATION_PRESETS,
  LIGHT_ANIMATION_PRESETS,
} from '../../core/animation/AnimationBlendingService';

// ============================================================================
// Types
// ============================================================================

interface LayerItemProps {
  layer: AnimationLayer;
  clipName?: string;
  isSelected: boolean;
  onSelect: () => void;
  onWeightChange: (weight: number) => void;
  onBlendModeChange: (mode: BlendMode) => void;
  onToggleSolo: () => void;
  onToggleMute: () => void;
  onDelete: () => void;
  onRename: () => void;
  onDuplicate: () => void;
}

// ============================================================================
// Blend Mode Info
// ============================================================================

const BLEND_MODE_INFO: Record<BlendMode, { label: string; description: string; color: string }> = {
  replace: {
    label: 'Replace',
    description: 'Completely replaces the value',
    color: '#2196f3',
  },
  additive: {
    label: 'Additive',
    description: 'Adds to the existing value',
    color: '#4caf50',
  },
  multiply: {
    label: 'Multiply',
    description: 'Multiplies with existing value',
    color: '#ff9800',
  },
  screen: {
    label: 'Screen',
    description: 'Lightens (inverse multiply)',
    color: '#e91e63',
  },
  overlay: {
    label: 'Overlay',
    description: 'Combines multiply and screen',
    color: '#9c27b0',
  },
};

// ============================================================================
// Layer Item Component
// ============================================================================

function LayerItem({
  layer,
  clipName,
  isSelected,
  onSelect,
  onWeightChange,
  onBlendModeChange,
  onToggleSolo,
  onToggleMute,
  onDelete,
  onRename,
  onDuplicate,
}: LayerItemProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);

  const blendModeInfo = BLEND_MODE_INFO[layer.blendMode];

  return (
    <Paper
      elevation={isSelected ? 2 : 0}
      sx={{
        mb: 1,
        backgroundColor: isSelected ? '#2a3a4a' : '#1a1a2a',
        border: `1px solid ${isSelected ? '#2196f3' : 'transparent'}`,
        borderRadius: 1,
        overflow: 'hidden',
        opacity: layer.muted ? 0.5 : 1}}
    >
      {/* Main row */}
      <Box
        onClick={onSelect}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          cursor: 'pointer', '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.03)',
          }}}
      >
        {/* Drag handle */}
        <DragIndicator sx={{ color: '#555', cursor: 'grab' }} fontSize="small" />

        {/* Solo/Mute buttons */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onToggleSolo(); }}
          sx={{ color: layer.solo ? '#ff9800' : '#555' }}
        >
          {layer.solo ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
        </IconButton>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          sx={{ color: layer.muted ? '#f44336' : '#555' }}
        >
          {layer.muted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
        </IconButton>

        {/* Layer info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {layer.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip
              label={clipName || 'No clip'}
              size="small"
              sx={{
                height: 16,
                fontSize: 9,
                backgroundColor: clipName ? '#2196f322' : '#33333344'}}
            />
            <Chip
              label={blendModeInfo.label}
              size="small"
              sx={{
                height: 16,
                fontSize: 9,
                backgroundColor: `${blendModeInfo.color}22`,
                color: blendModeInfo.color}}
            />
          </Box>
        </Box>

        {/* Weight slider */}
        <Box sx={{ width: 80, mr: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
            Weight: {Math.round(layer.weight * 100)}%
          </Typography>
          <Slider
            value={layer.weight}
            onChange={(_, v) => onWeightChange(v as number)}
            min={0}
            max={1}
            step={0.01}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
        </Box>

        {/* Expand/collapse */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>

        {/* More menu */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
      </Box>

      {/* Expanded section */}
      {expanded && (
        <Box sx={{ px: 2, pb: 2, pt: 1, borderTop: '1px solid #333' }}>
          {/* Blend mode selector */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Blend Mode</InputLabel>
            <Select
              value={layer.blendMode}
              label="Blend Mode"
              onChange={(e) => onBlendModeChange(e.target.value as BlendMode)}
            >
              {Object.entries(BLEND_MODE_INFO).map(([mode, info]) => (
                <MenuItem key={mode} value={mode}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: info.color}}
                    />
                    <Box>
                      <Typography variant="body2">{info.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {info.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Mask info */}
          {layer.mask && layer.mask.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Masked to: {layer.mask.join('')}
              </Typography>
            </Box>
          )}

          {/* Layer order */}
          <Typography variant="caption" color="text.secondary">
            Layer Order: {layer.order}
          </Typography>
        </Box>
      )}

      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { onRename(); setMenuAnchor(null); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          Rename
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate(); setMenuAnchor(null); }}>
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          Duplicate
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Paper>
  );
}

// ============================================================================
// Animation Preset Selector
// ============================================================================

interface PresetSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (presetId: string, category: 'camera' | 'light') => void;
}

function PresetSelector({ open, onClose, onSelect }: PresetSelectorProps) {
  const [category, setCategory] = useState<'camera' | 'light'>('camera');

  const presets = category === 'camera' ? CAMERA_ANIMATION_PRESETS : LIGHT_ANIMATION_PRESETS;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Animation Preset</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant={category === 'camera' ? 'contained' : 'outlined'}
            onClick={() => setCategory('camera')}
            size="small"
          >
            Camera
          </Button>
          <Button
            variant={category === 'light' ? 'contained' : 'outlined'}
            onClick={() => setCategory('light')}
            size="small"
          >
            Light
          </Button>
        </Box>

        <List>
          {Object.entries(presets).map(([id, preset]) => (
            <ListItem
              key={id}
              disablePadding
              sx={{
                border: '1px solid #333',
                borderRadius: 1,
                mb: 1}}
            >
              <ListItemIcon sx={{ pl: 2 }}>
                <Animation />
              </ListItemIcon>
              <ListItemText
                primary={preset.name}
                secondary={`Duration: ${preset.duration}s`}
              />
              <Button
                size="small"
                onClick={() => {
                  onSelect(id, category);
                  onClose();
                }}
              >
                Apply
              </Button>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

interface AnimationLayersPanelProps {
  clips?: Array<{ id: string; name: string }>;
  onCreateClipFromPreset?: (presetId: string, category: 'camera' | 'light') => void;
}

export function AnimationLayersPanel({
  clips = [],
  onCreateClipFromPreset,
}: AnimationLayersPanelProps) {
  const [layers, setLayers] = useState<AnimationLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(', ');
  const [presetSelectorOpen, setPresetSelectorOpen] = useState(false);

  // Load layers from service
  const loadLayers = useCallback(() => {
    setLayers(Array.from(animationBlendingService['layers'].values()));
  }, []);

  // Create new layer
  const handleCreateLayer = useCallback(() => {
    const layer = animationBlendingService.createLayer(`Layer ${layers.length + 1}`);
    loadLayers();
    setSelectedLayerId(layer.id);
  }, [layers.length, loadLayers]);

  // Delete layer
  const handleDeleteLayer = useCallback((layerId: string) => {
    animationBlendingService.deleteLayer(layerId);
    loadLayers();
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
  }, [selectedLayerId, loadLayers]);

  // Duplicate layer
  const handleDuplicateLayer = useCallback((layerId: string) => {
    const original = layers.find((l) => l.id === layerId);
    if (!original) return;

    const newLayer = animationBlendingService.createLayer(`${original.name} (Copy)`);
    animationBlendingService.setLayerClip(newLayer.id, original.clipId);
    animationBlendingService.setLayerWeight(newLayer.id, original.weight);
    animationBlendingService.setLayerBlendMode(newLayer.id, original.blendMode);
    loadLayers();
  }, [layers, loadLayers]);

  // Rename layer
  const handleStartRename = useCallback((layerId: string) => {
    const layer = layers.find((l) => l.id === layerId);
    if (layer) {
      setRenameValue(layer.name);
      setSelectedLayerId(layerId);
      setRenameDialogOpen(true);
    }
  }, [layers]);

  const handleConfirmRename = useCallback(() => {
    if (selectedLayerId) {
      const layer = animationBlendingService['layers'].get(selectedLayerId);
      if (layer) {
        layer.name = renameValue;
        loadLayers();
      }
    }
    setRenameDialogOpen(false);
  }, [selectedLayerId, renameValue, loadLayers]);

  // Weight change
  const handleWeightChange = useCallback((layerId: string, weight: number) => {
    animationBlendingService.setLayerWeight(layerId, weight);
    loadLayers();
  }, [loadLayers]);

  // Blend mode change
  const handleBlendModeChange = useCallback((layerId: string, mode: BlendMode) => {
    animationBlendingService.setLayerBlendMode(layerId, mode);
    loadLayers();
  }, [loadLayers]);

  // Solo toggle
  const handleToggleSolo = useCallback((layerId: string) => {
    animationBlendingService.toggleLayerSolo(layerId);
    loadLayers();
  }, [loadLayers]);

  // Mute toggle
  const handleToggleMute = useCallback((layerId: string) => {
    animationBlendingService.toggleLayerMute(layerId);
    loadLayers();
  }, [loadLayers]);

  // Apply preset
  const handleApplyPreset = useCallback((presetId: string, category: 'camera' | 'light') => {
    if (onCreateClipFromPreset) {
      onCreateClipFromPreset(presetId, category);
    }
  }, [onCreateClipFromPreset]);

  // Get clip name for layer
  const getClipName = useCallback((clipId: string | null): string | undefined => {
    if (!clipId) return undefined;
    return clips.find((c) => c.id === clipId)?.name;
  }, [clips]);

  const sortedLayers = useMemo(
    () => [...layers].sort((a, b) => a.order - b.order),
    [layers]
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Layers />
            <Typography variant="h6" fontWeight={700}>
              Animation Layers
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Add Preset">
              <IconButton size="small" onClick={() => setPresetSelectorOpen(true)}>
                <Animation />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add Layer">
              <IconButton size="small" onClick={handleCreateLayer}>
                <Add />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary">
          Stack animations with blend modes
        </Typography>
      </Box>

      {/* Layer list */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {sortedLayers.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <LayersClear sx={{ fontSize: 48, color: '#444', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No layers yet
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={handleCreateLayer}
              sx={{ mt: 2 }}
            >
              Add Layer
            </Button>
          </Box>
        ) : (
          sortedLayers.map((layer) => (
            <LayerItem
              key={layer.id}
              layer={layer}
              clipName={getClipName(layer.clipId)}
              isSelected={selectedLayerId === layer.id}
              onSelect={() => setSelectedLayerId(layer.id)}
              onWeightChange={(w) => handleWeightChange(layer.id, w)}
              onBlendModeChange={(m) => handleBlendModeChange(layer.id, m)}
              onToggleSolo={() => handleToggleSolo(layer.id)}
              onToggleMute={() => handleToggleMute(layer.id)}
              onDelete={() => handleDeleteLayer(layer.id)}
              onRename={() => handleStartRename(layer.id)}
              onDuplicate={() => handleDuplicateLayer(layer.id)}
            />
          ))
        )}
      </Box>

      {/* Footer info */}
      <Box sx={{ p: 1, borderTop: '1px solid #333', backgroundColor: '#1a1a1a' }}>
        <Typography variant="caption" color="text.secondary">
          {sortedLayers.length} layer(s) • {sortedLayers.filter((l) => !l.muted).length} active
        </Typography>
      </Box>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename Layer</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            label="Layer Name"
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRename} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preset Selector */}
      <PresetSelector
        open={presetSelectorOpen}
        onClose={() => setPresetSelectorOpen(false)}
        onSelect={handleApplyPreset}
      />
    </Box>
  );
}

export default AnimationLayersPanel;

