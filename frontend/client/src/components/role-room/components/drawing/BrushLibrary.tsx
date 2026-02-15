/**
 * BrushLibrary - Save and load custom brush presets
 * 
 * Features:
 * - Preset brush configurations
 * - Save custom brushes
 * - Import/Export brush packs
 * - Favorite brushes
 * - Recently used brushes
 * - Database persistence with settings cache fallback
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Grid,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Star,
  StarBorder,
  FileDownload,
  FileUpload,
  History,
  Brush,
  MoreVert,
  Save,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { BrushConfig, DEFAULT_BRUSH_CONFIG, AdvancedBrushType } from './AdvancedBrushEngine';
import settingsService from '../../services/settingsService';

// =============================================================================
// Types
// =============================================================================

export interface BrushPreset {
  id: string;
  name: string;
  config: BrushConfig;
  favorite: boolean;
  category: string;
  icon?: string; // Custom icon or emoji
  createdAt: number;
  usedAt?: number;
}

export interface BrushLibraryProps {
  currentConfig: BrushConfig;
  onBrushSelect: (config: BrushConfig) => void;
  onSaveCurrentBrush: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'virtualstudio-brush-library';
const SETTINGS_NAMESPACE = 'virtualStudio_brushLibrary';

const DEFAULT_PRESETS: BrushPreset[] = [
  {
    id: 'pencil-sketch',
    name: 'Sketch Pencil',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'pencil', size: 2, color: '#4a4a4a', grain: 0.8 },
    favorite: true,
    category: 'Drawing',
    icon: '✏️',
    createdAt: Date.now(),
  },
  {
    id: 'ink-pen',
    name: 'Fine Ink',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'ink', size: 1, color: '#000000', hardness: 0.9 },
    favorite: true,
    category: 'Drawing',
    icon: '🖊️',
    createdAt: Date.now(),
  },
  {
    id: 'watercolor-wash',
    name: 'Watercolor Wash',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'watercolor', size: 30, color: '#3b82f6', wetness: 0.9, opacity: 0.4 },
    favorite: false,
    category: 'Painting',
    icon: '💧',
    createdAt: Date.now(),
  },
  {
    id: 'thick-marker',
    name: 'Thick Marker',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'marker', size: 20, color: '#ef4444', opacity: 0.8 },
    favorite: false,
    category: 'Markers',
    icon: '🖍️',
    createdAt: Date.now(),
  },
  {
    id: 'soft-brush',
    name: 'Soft Brush',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'brush', size: 25, color: '#22c55e', hardness: 0.3, opacity: 0.6 },
    favorite: false,
    category: 'Painting',
    icon: '🖌️',
    createdAt: Date.now(),
  },
  {
    id: 'highlighter-yellow',
    name: 'Yellow Highlighter',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'highlighter', size: 15, color: '#fbbf24', opacity: 0.5 },
    favorite: false,
    category: 'Markers',
    icon: '💛',
    createdAt: Date.now(),
  },
  {
    id: 'calligraphy',
    name: 'Calligraphy',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'pen', size: 6, color: '#1a1a2e', tiltSensitivity: 1, pressureSensitivity: 1 },
    favorite: true,
    category: 'Drawing',
    icon: '✒️',
    createdAt: Date.now(),
  },
  {
    id: 'airbrush',
    name: 'Airbrush',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'brush', size: 40, color: '#8b5cf6', hardness: 0.1, flow: 0.3, opacity: 0.2 },
    favorite: false,
    category: 'Painting',
    icon: '🌫️',
    createdAt: Date.now(),
  },
];

const CATEGORIES = ['All', 'Drawing', 'Painting', 'Markers', 'Custom'];

// =============================================================================
// Styled Components
// =============================================================================

const LibraryContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  minWidth: 280,
}));

const PresetCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  gap: 10,
  cursor: 'pointer',
  backgroundColor: selected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
  borderLeft: selected ? '3px solid #3b82f6' : '3px solid transparent',
  transition: 'all 0.15s',
  '&:hover': {
    backgroundColor: selected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.05)',
  },
}));

const BrushPreview = styled(Box)({
  width: 36,
  height: 36,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  backgroundColor: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
});

// =============================================================================
// Hooks
// =============================================================================

// Database availability cache
let dbAvailable: boolean | null = null;

async function checkDatabaseAvailability(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;
  try {
    const response = await fetch('/api/casting/health');
    const result = await response.json();
    dbAvailable = result.status === 'healthy';
    return dbAvailable;
  } catch {
    dbAvailable = false;
    return false;
  }
}

function useBrushLibrary() {
  const [presets, setPresets] = useState<BrushPreset[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);

  // Load from database with settings cache fallback
  useEffect(() => {
    const loadPresets = async () => {
      try {
        if (await checkDatabaseAvailability()) {
          const response = await fetch('/api/user/brush-presets');
          if (response.ok) {
            const data = await response.json();
            if (data.presets?.length > 0) {
              setPresets(data.presets);
              setRecentlyUsed(data.recentlyUsed || []);
              await settingsService.setSetting(SETTINGS_NAMESPACE, data);
              return;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load from database:', error);
      }

      const cached = await settingsService.getSetting<{ presets: BrushPreset[]; recentlyUsed: string[] }>(
        SETTINGS_NAMESPACE
      );
      if (cached?.presets?.length) {
        setPresets(cached.presets);
        setRecentlyUsed(cached.recentlyUsed || []);
        return;
      }

      setPresets(DEFAULT_PRESETS);
    };
    loadPresets();
  }, []);

  // Save to database with settings cache backup
  const save = useCallback(async () => {
    const data = { presets, recentlyUsed };

    await settingsService.setSetting(SETTINGS_NAMESPACE, data);
    
    // Try to save to database
    try {
      if (await checkDatabaseAvailability()) {
        await fetch('/api/user/brush-presets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    } catch (error) {
      console.warn('Failed to save brush library to database:', error);
    }
  }, [presets, recentlyUsed]);

  useEffect(() => {
    if (presets.length > 0) {
      save();
    }
  }, [presets, recentlyUsed, save]);

  const addPreset = useCallback((preset: BrushPreset) => {
    setPresets(prev => [...prev, preset]);
  }, []);

  const updatePreset = useCallback((id: string, updates: Partial<BrushPreset>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setPresets(prev => prev.map(p => 
      p.id === id ? { ...p, favorite: !p.favorite } : p
    ));
  }, []);

  const markUsed = useCallback((id: string) => {
    setPresets(prev => prev.map(p => 
      p.id === id ? { ...p, usedAt: Date.now() } : p
    ));
    setRecentlyUsed(prev => {
      const filtered = prev.filter(i => i !== id);
      return [id, ...filtered].slice(0, 10);
    });
  }, []);

  const exportPresets = useCallback(() => {
    const data = JSON.stringify(presets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'brush-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  const importPresets = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          const newPresets = imported.map((p: BrushPreset) => ({
            ...p,
            id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            category: 'Custom',
          }));
          setPresets(prev => [...prev, ...newPresets]);
        }
      } catch {
        console.error('Failed to import brush presets');
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    presets,
    recentlyUsed,
    addPreset,
    updatePreset,
    deletePreset,
    toggleFavorite,
    markUsed,
    exportPresets,
    importPresets,
  };
}

// =============================================================================
// Component
// =============================================================================

export const BrushLibrary: React.FC<BrushLibraryProps> = ({
  currentConfig,
  onBrushSelect,
  onSaveCurrentBrush,
}) => {
  const {
    presets,
    recentlyUsed,
    addPreset,
    updatePreset,
    deletePreset,
    toggleFavorite,
    markUsed,
    exportPresets,
    importPresets,
  } = useBrushLibrary();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuPresetId, setMenuPresetId] = useState<string | null>(null);

  const filteredPresets = presets.filter(p => 
    selectedCategory === 'All' || p.category === selectedCategory
  );

  const favoritePresets = presets.filter(p => p.favorite);
  const recentPresets = recentlyUsed
    .map(id => presets.find(p => p.id === id))
    .filter(Boolean) as BrushPreset[];

  const handleSelectPreset = useCallback((preset: BrushPreset) => {
    setSelectedPresetId(preset.id);
    markUsed(preset.id);
    onBrushSelect(preset.config);
  }, [markUsed, onBrushSelect]);

  const handleSavePreset = useCallback(() => {
    if (!newPresetName.trim()) return;
    
    const newPreset: BrushPreset = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: newPresetName.trim(),
      config: currentConfig,
      favorite: false,
      category: 'Custom',
      icon: '🎨',
      createdAt: Date.now(),
    };
    
    addPreset(newPreset);
    setSaveDialogOpen(false);
    setNewPresetName('');
  }, [newPresetName, currentConfig, addPreset]);

  const handleDeletePreset = useCallback(() => {
    if (menuPresetId) {
      deletePreset(menuPresetId);
      setMenuAnchor(null);
      setMenuPresetId(null);
    }
  }, [menuPresetId, deletePreset]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <LibraryContainer>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Brush sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Brush Library
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Save Current Brush">
              <IconButton size="small" onClick={() => setSaveDialogOpen(true)}>
                <Save sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Import">
              <IconButton size="small" onClick={() => fileInputRef.current?.click()}>
                <FileUpload sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export All">
              <IconButton size="small" onClick={exportPresets}>
                <FileDownload sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importPresets(file);
          }}
        />
      </Box>

      {/* Category tabs */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto' }}>
          {CATEGORIES.map(cat => (
            <Chip
              key={cat}
              label={cat}
              size="small"
              onClick={() => setSelectedCategory(cat)}
              sx={{
                bgcolor: selectedCategory === cat ? 'rgba(59,130,246,0.3)' : 'transparent',
                border: selectedCategory === cat ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                fontSize: 11,
                height: 24,
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Favorites section */}
      {favoritePresets.length > 0 && selectedCategory === 'All' && (
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="caption" sx={{ px: 1.5, py: 0.5, color: 'text.secondary', display: 'block' }}>
            ⭐ Favorites
          </Typography>
          {favoritePresets.slice(0, 3).map(preset => (
            <PresetCard
              key={preset.id}
              selected={selectedPresetId === preset.id}
              onClick={() => handleSelectPreset(preset)}
            >
              <BrushPreview sx={{ bgcolor: preset.config.color + '30' }}>
                {preset.icon || '🖌️'}
              </BrushPreview>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>
                  {preset.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
                  {preset.config.type} • {preset.config.size}px
                </Typography>
              </Box>
            </PresetCard>
          ))}
        </Box>
      )}

      {/* Recently used */}
      {recentPresets.length > 0 && selectedCategory === 'All' && (
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="caption" sx={{ px: 1.5, py: 0.5, color: 'text.secondary', display: 'block' }}>
            <History sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
            Recent
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ px: 1.5, pb: 1, overflowX: 'auto' }}>
            {recentPresets.slice(0, 5).map(preset => (
              <Tooltip key={preset.id} title={preset.name}>
                <Box
                  onClick={() => handleSelectPreset(preset)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    border: selectedPresetId === preset.id ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.2)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                  }}
                >
                  {preset.icon || '🖌️'}
                </Box>
              </Tooltip>
            ))}
          </Stack>
        </Box>
      )}

      {/* Preset list */}
      <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
        {filteredPresets.map(preset => (
          <PresetCard
            key={preset.id}
            selected={selectedPresetId === preset.id}
            onClick={() => handleSelectPreset(preset)}
          >
            <BrushPreview sx={{ bgcolor: preset.config.color + '30' }}>
              {preset.icon || '🖌️'}
            </BrushPreview>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontSize: 12 }}>
                {preset.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
                {preset.config.type} • {preset.config.size}px
              </Typography>
            </Box>
            <Stack direction="row" spacing={0}>
              <IconButton 
                size="small" 
                onClick={(e) => { e.stopPropagation(); toggleFavorite(preset.id); }}
              >
                {preset.favorite ? (
                  <Star sx={{ fontSize: 14, color: '#fbbf24' }} />
                ) : (
                  <StarBorder sx={{ fontSize: 14 }} />
                )}
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuAnchor(e.currentTarget);
                  setMenuPresetId(preset.id);
                }}
              >
                <MoreVert sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
          </PresetCard>
        ))}
      </Box>

      {/* Preset menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{
          paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } }
        }}
      >
        <MenuItem onClick={handleDeletePreset} sx={{ fontSize: 12, color: 'error.main' }}>
          <Delete sx={{ fontSize: 14, mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Save dialog */}
      <Dialog 
        open={saveDialogOpen} 
        onClose={() => setSaveDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'rgba(30,30,40,0.98)', backgroundImage: 'none' } }}
      >
        <DialogTitle>Save Brush Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Preset Name"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            sx={{ mt: 1 }}
          />
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Current Settings:
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Type: {currentConfig.type} | Size: {currentConfig.size}px | Opacity: {Math.round(currentConfig.opacity * 100)}%
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePreset} variant="contained" disabled={!newPresetName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </LibraryContainer>
  );
};

export default BrushLibrary;
