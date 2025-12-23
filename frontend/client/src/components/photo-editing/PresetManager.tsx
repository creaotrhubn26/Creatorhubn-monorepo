/**
 * PRESET MANAGER
 * Lightroom-style preset management for photo editing
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActions,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Star,
  StarBorder,
  Delete,
  Edit,
  Download,
  Upload,
  ContentCopy,
  MoreVert,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

export interface Preset {
  id: string;
  name: string;
  category?: string;
  description?: string;
  previewImageUrl?: string;
  adjustments: any;
  toneCurves?: any;
  hslAdjustments?: any;
  masks?: any[];
  transform?: any;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
}

interface PresetManagerProps {
  userId?: string;
  onPresetSelect?: (preset: Preset) => void;
  onPresetSave?: (preset: Partial<Preset>) => Promise<void>;
  onPresetDelete?: (presetId: string) => Promise<void>;
  initialPresets?: Preset[];
}

export default function PresetManager({
  userId,
  onPresetSelect,
  onPresetSave,
  onPresetDelete,
  initialPresets = [],
}: PresetManagerProps) {
  const theming = useTheming('photographer');
  const [presets, setPresets] = useState<Preset[]>(initialPresets);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetCategory, setPresetCategory] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  const categories = ['Portrait','Landscape','Wedding','Commercial','Vintage','Cinematic','Custom'];

  const handleCreatePreset = useCallback(() => {
    setEditingPreset(null);
    setPresetName('');
    setPresetCategory(', ');
    setPresetDescription(', ');
    setOpenDialog(true);
  }, []);

  const handleEditPreset = useCallback((preset: Preset) => {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetCategory(preset.category || ', ');
    setPresetDescription(preset.description || '');
    setOpenDialog(true);
  }, []);

  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) return;

    const presetData: Partial<Preset> = {
      name: presetName,
      category: presetCategory || undefined,
      description: presetDescription || undefined,
    };

    if (editingPreset) {
      presetData.id = editingPreset.id;
    }

    await onPresetSave?.(presetData);

    setOpenDialog(false);
    setEditingPreset(null);
  }, [presetName, presetCategory, presetDescription, editingPreset, onPresetSave]);

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      if (window.confirm('Are you sure you want to delete this preset?')) {
        await onPresetDelete?.(presetId);
        setAnchorEl(null);
      }
    },
    [onPresetDelete]
  );

  const handleToggleFavorite = useCallback(
    (preset: Preset) => {
      setPresets((prev) =>
        prev.map((p) => (p.id === preset.id ? { ...p, isFavorite: !p.isFavorite } : p))
      );
    },
    []
  );

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, preset: Preset) => {
    setAnchorEl(event.currentTarget);
    setSelectedPreset(preset);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedPreset(null);
  }, []);

  const filteredPresets = presets.filter((p) => !presetCategory || p.category === presetCategory);

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Presets
          </Typography>
          <Button startIcon={<Add />} variant="contained" onClick={handleCreatePreset}>
            Create Preset
          </Button>
        </Box>

        {/* Category Filter */}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            label="All"
            onClick={() => setPresetCategory('')}
            color={presetCategory === '' ? 'primary' : 'default'}
            size="small"
          />
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setPresetCategory(cat)}
              color={presetCategory === cat ? 'primary' : 'default'}
              size="small"
            />
          ))}
        </Stack>

        {/* Presets Grid */}
        <Grid container spacing={2}>
          {filteredPresets.map((preset) => (
            <Grid item xs={12} sm={6} md={4} key={preset.id}>
              <Card
                sx={{
                  cursor: 'pointer', '&:hover': { boxShadow: 4 }}}
                onClick={() => onPresetSelect?.(preset)}
              >
                {preset.previewImageUrl && (
                  <Box
                    sx={{
                      width: '100%',
                      height: 120,
                      backgroundImage: `url(${preset.previewImageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'}}
                  />
                )}
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">{preset.name}</Typography>
                      {preset.category && (
                        <Chip label={preset.category} size="small" sx={{ mt: 0.5 }} />
                      )}
                      {preset.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {preset.description}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(preset);
                      }}
                    >
                      {preset.isFavorite ? <Star color="warning" /> : <StarBorder />}
                    </IconButton>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => onPresetSelect?.(preset)}>
                    Apply
                  </Button>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenuOpen(e, preset);
                    }}
                  >
                    <MoreVert />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        {filteredPresets.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No presets found. Create your first preset to get started.
          </Typography>
        )}

        {/* Preset Menu */}
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem
            onClick={() => {
              if (selectedPreset) handleEditPreset(selectedPreset);
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedPreset) {
                navigator.clipboard.writeText(JSON.stringify(selectedPreset));
              }
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <ContentCopy fontSize="small" />
            </ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedPreset) handleDeletePreset(selectedPreset.id);
            }}
          >
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>

        {/* Create/Edit Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingPreset ? 'Edit Preset' : 'Create Preset'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Preset Name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Category"
                value={presetCategory}
                onChange={(e) => setPresetCategory(e.target.value)}
                fullWidth
                select
                SelectProps={{ native: false }}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Description"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSavePreset} disabled={!presetName.trim()}>
              {editingPreset ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}

