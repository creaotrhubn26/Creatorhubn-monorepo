/**
 * Light Groups Panel
 * 
 * Manage light groups, pattern visualization, and scene presets
 */

import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../core/services/logger';
import { lightPresetsService } from '../../core/services/userDataService';

const log = logger.module('LightGroupsPanel, ');
import {
  Box,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Paper,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  GridOn as PatternIcon,
  Save as SaveIcon,
  FolderOpen as LoadIcon,
  Group as GroupIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  VolumeOff as MuteIcon,
  VolumeUp as UnmuteIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useAppStore } from '@/state/store';
import { lightPatternService, type LightPattern } from '@/core/services/lightPatternService';
import { useActions } from '../../state/selectors';

// Lighting Setup Preset Interface
interface LightingPreset {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lights: Array<{
    type: string;
    position: [number, number, number];
    rotation: [number, number, number];
    power: number;
    cct?: number;
    modifier?: string;
    modifierSize?: [number, number];
  }>;
  patternSlug?: string;
}

export function LightGroupsPanel() {
  const showPatternVisualization = useAppStore((s: any) => s.showPatternVisualization);
  const activePatternSlug = useAppStore((s: any) => s.activePatternSlug);
  const showShadows = useAppStore((s: any) => s.showShadows);
  const showHighlights = useAppStore((s: any) => s.showHighlights);
  const togglePatternVisualization = useAppStore((s: any) => s.togglePatternVisualization);
  const setActivePattern = useAppStore((s: any) => s.setActivePattern);
  const toggleShadows = useAppStore((s: any) => s.toggleShadows);
  const toggleHighlights = useAppStore((s: any) => s.toggleHighlights);
  const nodes = useAppStore((s: any) => s.scene.nodes);

  const storeActions = useActions();
  
  // Light groups state (local for now - could be moved to store)
  interface LightGroup {
    id: string;
    name: string;
    color: string;
    lightIds: string[];
    power: number;
    groupPower?: number;
    isMuted: boolean;
    isLocked: boolean;
    ratioLock?: boolean;
  }
  const [lightGroups, setLightGroups] = useState<LightGroup[]>([]);

  // Light group actions
  const actions = {
    ...storeActions,
    updateLightGroup: (id: string, updates: Partial<LightGroup>) => {
      setLightGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    },
    deleteLightGroup: (id: string) => {
      setLightGroups(prev => prev.filter(g => g.id !== id));
    },
    autoCreateGroupsFromPattern: () => {
      // Auto-create groups from detected pattern lights
      const newGroups: LightGroup[] = [];
      lightNodes.forEach((node: any, idx: number) => {
        const role = node.patternContext?.role || 'light';
        const existingGroup = newGroups.find(g => g.name === role);
        if (existingGroup) {
          existingGroup.lightIds.push(node.id);
        } else {
          newGroups.push({
            id: `group_${Date.now()}_${idx}`,
            name: role,
            color: role === 'key' ? '#fbbf24' : role === 'fill' ? '#60a5fa' : role === 'rim' ? '#a78bfa' : '#6b7280',
            lightIds: [node.id],
            power: 1,
            isMuted: false,
            isLocked: false,
          });
        }
      });
      setLightGroups(newGroups);
    },
    applyGroupPowerToScene: (groupId: string) => {
      const group = lightGroups.find(g => g.id === groupId);
      if (!group) return;
      // Update actual light nodes with group power
      group.lightIds.forEach(lightId => {
        storeActions.updateNode(lightId, { 
          light: { power: (group.groupPower || 1) * group.power }
        });
      });
    },
  };

  const [patterns, setPatterns] = useState<LightPattern[]>([]);
  const [loading, setLoading] = useState(false);

  // Save/Load dialogs
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [savedPresets, setSavedPresets] = useState<LightingPreset[]>([]);

  // Get light nodes - defined early for use in callbacks
  const lightNodes = nodes.filter((n: any) => n.light);

  // Load saved presets on mount (DB-first with localStorage fallback)
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const presets = await lightPresetsService.getAll();
        // Convert LightPreset[] to LightingPreset[]
        setSavedPresets(presets.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || ', ',
          createdAt: p.createdAt,
          lights: p.lights as any[],
          patternSlug: p.category,
        })));
      } catch {
        log.warn('Failed to load lighting presets');
      }
    };
    loadPresets();
  }, []);

  // Save current lighting setup (DB-first with localStorage fallback)
  const handleSavePreset = useCallback(async () => {
    const lightsData = lightNodes.map((n: any, idx: number) => ({
      id: `light_${idx}`,
      type: n.type || 'area',
      position: { 
        x: n.transform?.position?.[0] || 0, 
        y: n.transform?.position?.[1] || 0, 
        z: n.transform?.position?.[2] || 0 
      },
      rotation: { 
        x: n.transform?.rotation?.[0] || 0, 
        y: n.transform?.rotation?.[1] || 0, 
        z: n.transform?.rotation?.[2] || 0 
      },
      power: n.light?.power || 0.5,
      color: '#ffffff',
      temperature: n.light?.cct || 5600,
      modifier: n.light?.modifier,
      modifierSize: n.light?.modifierSize,
    }));

    const newPreset = await lightPresetsService.create({
      name: presetName || 'Untitled Setup',
      description: presetDescription,
      category: activePatternSlug || 'custom',
      lights: lightsData,
      isPublic: false,
    });

    if (newPreset) {
      setSavedPresets(prev => [...prev, {
        id: newPreset.id,
        name: newPreset.name,
        description: newPreset.description || ', ',
        createdAt: newPreset.createdAt,
        lights: lightsData.map((l: typeof lightsData[number]) => ({
          type: l.type,
          position: [l.position.x, l.position.y, l.position.z] as [number, number, number],
          rotation: [l.rotation.x, l.rotation.y, l.rotation.z] as [number, number, number],
          power: l.power,
          cct: l.temperature,
          modifier: l.modifier,
          modifierSize: l.modifierSize,
        })),
        patternSlug: newPreset.category,
      }]);
    }
    
    setSaveDialogOpen(false);
    setPresetName(', ');
    setPresetDescription('');
  }, [presetName, presetDescription, lightNodes, activePatternSlug]);

  // Load a lighting setup
  const handleLoadPreset = (preset: LightingPreset) => {
    // Remove existing lights
    lightNodes.forEach((n: any) => {
      actions.deleteNode(n.id);
    });

    // Add lights from preset
    preset.lights.forEach((light, idx) => {
      actions.addNode({
        id: `light_${Date.now()}_${idx}`,
        type: light.type as any,
        name: `${light.type} ${idx + 1}`,
        transform: {
          position: light.position,
          rotation: light.rotation,
          scale: [1, 1, 1],
        },
        visible: true,
        light: {
          power: light.power,
          cct: light.cct,
          modifier: light.modifier as any,
          modifierSize: light.modifierSize,
        },
      });
    });

    // Set pattern if specified
    if (preset.patternSlug) {
      setActivePattern(preset.patternSlug);
    }

    setLoadDialogOpen(false);
  };

  // Delete a preset (DB-first with localStorage fallback)
  const handleDeletePreset = useCallback(async (presetId: string) => {
    await lightPresetsService.delete(presetId);
    setSavedPresets(prev => prev.filter((p) => p.id !== presetId));
  }, []);

  // Fetch patterns on mount
  useEffect(() => {
    setLoading(true);
    lightPatternService.getAllPatterns().then((p) => {
      setPatterns(p);
      setLoading(false);
    });
  }, []);

  // Detect if any lights have pattern context
  const detectedPatterns = lightNodes
    .filter((n: any) => n.patternContext)
    .map((n: any) => n.patternContext);

  const uniqueDetectedPatterns = Array.from(
    new Set(detectedPatterns.map((p: any) => p?.patternSlug))
  ).filter(Boolean) as string[];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupIcon /> Light Groups & Patterns
      </Typography>

      {/* Pattern Visualization Toggle */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showPatternVisualization}
              onChange={togglePatternVisualization}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {showPatternVisualization ? <VisibilityIcon /> : <VisibilityOffIcon />}
              <Typography variant="body2">Show Pattern Visualization</Typography>
            </Box>
          }
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
          Display ideal light positions, angles, and distances in 3D scene
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Shadow & Highlight Visualization */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showShadows}
              onChange={toggleShadows}
              color="primary"
            />
          }
          label={
            <Typography variant="body2">Show Shadow Directions</Typography>
          }
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
          Display shadow directions cast by each light
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={showHighlights}
              onChange={toggleHighlights}
              color="primary"
            />
          }
          label={
            <Typography variant="body2">Show Highlight Warnings</Typography>
          }
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
          Warn when lights may cause clipping
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Pattern Selection */}
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Active Pattern</InputLabel>
          <Select
            value={activePatternSlug || ''}
            onChange={(e) => setActivePattern(e.target.value || null)}
            label="Active Pattern"
            disabled={loading}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {patterns.map((pattern) => (
              <MenuItem key={pattern.id} value={pattern.slug}>
                {pattern.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Select a pattern to visualize in the 3D scene
        </Typography>
      </Box>

      {/* Detected Patterns */}
      {uniqueDetectedPatterns.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom sx={{ fontWeight: 600}}>
            Detected Patterns:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {uniqueDetectedPatterns.map((slug) => (
              <Chip
                key={slug}
                label={slug}
                size="small"
                color="primary"
                variant="outlined"
                onClick={() => setActivePattern(slug as string)}
                icon={<PatternIcon />}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Click to visualize detected pattern
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Light Groups Management */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600}}>
            Light Groups:
          </Typography>
          <Tooltip title="Auto-create groups from detected pattern">
            <IconButton
              size="small"
              onClick={() => actions.autoCreateGroupsFromPattern()}
              disabled={uniqueDetectedPatterns.length === 0}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {lightGroups.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No groups created. Click + to auto-create from pattern.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {lightGroups.map((group) => (
              <Paper
                key={group.id}
                elevation={1}
                sx={{
                  p: 1.5,
                  bgcolor: group.isMuted ? '#f1f5f9' : '#fff',
                  border: `2px solid ${group.color}`,
                  opacity: group.isMuted ? 0.6 : 1}}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    {group.name}
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title={group.isMuted ? 'Unmute' : 'Mute'}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          actions.updateLightGroup(group.id, { isMuted: !group.isMuted });
                          if (!group.isMuted) {
                            actions.applyGroupPowerToScene(group.id);
                          }
                        }}
                      >
                        {group.isMuted ? <MuteIcon fontSize="small" /> : <UnmuteIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={group.isLocked ? 'Unlock' : 'Lock'}>
                      <IconButton
                        size="small"
                        onClick={() => actions.updateLightGroup(group.id, { isLocked: !group.isLocked })}
                      >
                        {group.isLocked ? <LockIcon fontSize="small" /> : <UnlockIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete group">
                      <IconButton
                        size="small"
                        onClick={() => actions.deleteLightGroup(group.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>

                <Chip
                  label={group.name}
                  size="small"
                  sx={{ bgcolor: group.color, color: '#fff', fontSize: 10, mb: 1 }}
                />

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {group.lightIds.length} light{group.lightIds.length !== 1 ? 's' : ','}
                </Typography>

                {/* Group Power Slider */}
                <Box sx={{ px: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Group Power: {((group.groupPower ?? 1) * 100).toFixed(0)}%
                  </Typography>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={(group.groupPower ?? 1) * 100}
                    onChange={(e) => {
                      const newPower = parseFloat(e.target.value) / 100;
                      actions.updateLightGroup(group.id, { groupPower: newPower });
                      actions.applyGroupPowerToScene(group.id);
                    }}
                    disabled={group.isLocked || group.isMuted}
                    style={{ width: '100%' }}
                  />
                </Box>

                {/* Ratio Lock Toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={group.ratioLock}
                      onChange={(e) => actions.updateLightGroup(group.id, { ratioLock: e.target.checked })}
                      size="small"
                      disabled={group.isLocked}
                    />
                  }
                  label={<Typography variant="caption">Lock Ratios</Typography>}
                  sx={{ mt: 0.5 }}
                />
              </Paper>
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Scene Presets */}
      <Box>
        <Typography variant="body2" gutterBottom sx={{ fontWeight: 600}}>
          Scene Presets:
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Save current lighting setup">
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => setSaveDialogOpen(true)}
              disabled={lightNodes.length === 0}
            >
              Save
            </Button>
          </Tooltip>
          <Tooltip title="Load saved lighting setup">
            <Button
              variant="outlined"
              size="small"
              startIcon={<LoadIcon />}
              onClick={() => setLoadDialogOpen(true)}
              disabled={savedPresets.length === 0}
            >
              Load ({savedPresets.length})
            </Button>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {savedPresets.length} saved lighting setup{savedPresets.length !== 1 ? 's' : ','}
        </Typography>
      </Box>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Lighting Setup</DialogTitle>
        <DialogContent>
          <TextField
            label="Preset Name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            fullWidth
            sx={{ mt: 1, mb: 2 }}
            placeholder="e.g., Portrait 3-Point"
          />
          <TextField
            label="Description (optional)"
            value={presetDescription}
            onChange={(e) => setPresetDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Describe this lighting setup..."
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            This will save {lightNodes.length} light{lightNodes.length !== 1 ? 's' : ', '} and their settings.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSavePreset}
            startIcon={<SaveIcon />}
          >
            Save Preset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onClose={() => setLoadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Load Lighting Setup</DialogTitle>
        <DialogContent>
          {savedPresets.length === 0 ? (
            <Alert severity="info">No saved presets yet. Save your current setup first.</Alert>
          ) : (
            <List>
              {savedPresets.map((preset) => (
                <ListItem
                  key={preset.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1}}
                >
                  <ListItemText
                    primary={preset.name}
                    secondary={
                      <>
                        {preset.description && <span>{preset.description}<br /></span>}
                        {preset.lights.length} light{preset.lights.length !== 1 ? 's' :','} | 
                        {new Date(preset.createdAt).toLocaleDateString()}
                        {preset.patternSlug && <Chip label={preset.patternSlug} size="small" sx={{ ml: 1 }} />}
                      </>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Load this preset">
                      <IconButton
                        edge="end"
                        onClick={() => handleLoadPreset(preset)}
                        color="primary"
                      >
                        <CheckIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete preset">
                      <IconButton
                        edge="end"
                        onClick={() => handleDeletePreset(preset.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

