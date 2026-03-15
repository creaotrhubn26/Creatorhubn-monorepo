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
  Menu,
  MenuItem,
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
import { DEFAULT_BRUSH_CONFIG, type BrushConfig } from './AdvancedBrushEngine';
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
  {
    id: 'soft-charcoal-shading',
    name: 'Soft Charcoal',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'pencil',
      size: 18,
      color: '#2f2f34',
      hardness: 0.18,
      flow: 0.42,
      grain: 0.9,
      opacity: 0.3,
      pressureSensitivity: 0.95,
    },
    favorite: true,
    category: 'Shading',
    icon: '🪨',
    createdAt: Date.now(),
  },
  {
    id: 'soft-airbrush-shading',
    name: 'Soft Airbrush',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'brush',
      size: 42,
      color: '#42485a',
      hardness: 0.08,
      flow: 0.28,
      grain: 0.15,
      opacity: 0.25,
      pressureSensitivity: 0.8,
      tiltSensitivity: 0.75,
    },
    favorite: true,
    category: 'Shading',
    icon: '🌫️',
    createdAt: Date.now(),
  },
  {
    id: 'graphite-shading',
    name: 'Graphite Shading',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'pencil',
      size: 14,
      color: '#3b3b3b',
      hardness: 0.34,
      flow: 0.56,
      grain: 0.82,
      opacity: 0.35,
      pressureSensitivity: 0.9,
    },
    favorite: true,
    category: 'Shading',
    icon: '✏️',
    createdAt: Date.now(),
  },
  {
    id: 'texture-grain-forest',
    name: 'Texture Grain',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'pencil',
      size: 22,
      color: '#2e3130',
      hardness: 0.24,
      flow: 0.5,
      grain: 1,
      opacity: 0.34,
      pressureSensitivity: 0.92,
      tiltSensitivity: 0.7,
    },
    favorite: true,
    category: 'Texture',
    icon: '🌲',
    createdAt: Date.now(),
  },
  {
    id: 'dry-brush',
    name: 'Dry Brush',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'brush',
      size: 20,
      color: '#4a4a4f',
      hardness: 0.72,
      flow: 0.36,
      grain: 0.82,
      opacity: 0.32,
      pressureSensitivity: 0.86,
    },
    favorite: false,
    category: 'Texture',
    icon: '🖌️',
    createdAt: Date.now(),
  },
  {
    id: 'grain-brush',
    name: 'Grain Brush',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'pencil',
      size: 16,
      color: '#3d3f42',
      hardness: 0.28,
      flow: 0.48,
      grain: 0.96,
      opacity: 0.3,
      pressureSensitivity: 0.9,
    },
    favorite: false,
    category: 'Texture',
    icon: '🪨',
    createdAt: Date.now(),
  },
  {
    id: 'speed-lines',
    name: 'Speed Lines',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'pen',
      size: 3,
      color: '#171717',
      hardness: 0.96,
      flow: 1,
      grain: 0.08,
      opacity: 0.58,
      pressureSensitivity: 0.95,
      tiltSensitivity: 0.35,
    },
    favorite: true,
    category: 'Action',
    icon: '💨',
    createdAt: Date.now(),
  },
  {
    id: 'motion-brush',
    name: 'Motion Brush',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'brush',
      size: 24,
      color: '#20262f',
      hardness: 0.2,
      flow: 0.82,
      grain: 0.25,
      opacity: 0.4,
      pressureSensitivity: 0.94,
      tiltSensitivity: 0.78,
    },
    favorite: true,
    category: 'Action',
    icon: '⚡',
    createdAt: Date.now(),
  },
  {
    id: 'impact-brush',
    name: 'Impact Brush',
    config: {
      ...DEFAULT_BRUSH_CONFIG,
      type: 'marker',
      size: 12,
      color: '#151515',
      hardness: 0.86,
      flow: 1,
      grain: 0.2,
      opacity: 0.68,
      pressureSensitivity: 0.88,
      tiltSensitivity: 0.65,
    },
    favorite: true,
    category: 'Action',
    icon: '💥',
    createdAt: Date.now(),
  },
];

const CATEGORIES = ['All', 'Drawing', 'Painting', 'Shading', 'Texture', 'Action', 'Markers', 'Custom'];

function mergeWithDefaultPresets(existingPresets: BrushPreset[]): BrushPreset[] {
  if (!Array.isArray(existingPresets) || existingPresets.length === 0) {
    return [...DEFAULT_PRESETS];
  }

  const existingPresetIds = new Set(existingPresets.map((preset) => preset.id));
  const missingDefaultPresets = DEFAULT_PRESETS.filter((preset) => !existingPresetIds.has(preset.id));

  if (missingDefaultPresets.length === 0) {
    return existingPresets;
  }

  return [...existingPresets, ...missingDefaultPresets];
}

// =============================================================================
// Styled Components
// =============================================================================

const LibraryContainer = styled(Paper)(() => ({
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
let brushPresetApiAvailable: boolean | null = null;
let brushPresetApiCheckPromise: Promise<boolean> | null = null;
let brushPresetApiFallbackLogged = false;

function markBrushPresetApiUnavailable(reason?: string): void {
  brushPresetApiAvailable = false;

  if (brushPresetApiFallbackLogged) {
    return;
  }

  const detail = reason ? ` (${reason})` : '';
  console.info(`Brush preset API unavailable${detail}. Falling back to local settings cache.`);
  brushPresetApiFallbackLogged = true;
}

async function checkDatabaseAvailability(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;
  try {
    const response = await fetch('/api/casting/health');
    if (!response.ok) {
      dbAvailable = false;
      return false;
    }
    const result = await response.json();
    dbAvailable = result.status === 'healthy';
    return dbAvailable;
  } catch {
    dbAvailable = false;
    return false;
  }
}

async function checkBrushPresetApiAvailability(): Promise<boolean> {
  if (brushPresetApiAvailable !== null) {
    return brushPresetApiAvailable;
  }

  if (brushPresetApiCheckPromise) {
    return brushPresetApiCheckPromise;
  }

  brushPresetApiCheckPromise = (async () => {
    const dbIsAvailable = await checkDatabaseAvailability();
    if (!dbIsAvailable) {
      brushPresetApiAvailable = false;
      return false;
    }

    try {
      const response = await fetch('/api/user/brush-presets', { method: 'HEAD' });
      if (response.status === 404) {
        markBrushPresetApiUnavailable('missing /api/user/brush-presets route');
        return false;
      }

      const available = response.ok || response.status === 405;
      brushPresetApiAvailable = available;
      if (!available) {
        markBrushPresetApiUnavailable(`status ${response.status}`);
      }
      return available;
    } catch {
      brushPresetApiAvailable = false;
      return false;
    } finally {
      brushPresetApiCheckPromise = null;
    }
  })();

  return brushPresetApiCheckPromise;
}

function useBrushLibrary() {
  const [presets, setPresets] = useState<BrushPreset[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);

  // Load from database with settings cache fallback
  useEffect(() => {
    const loadPresets = async () => {
      try {
        if (await checkBrushPresetApiAvailability()) {
          const response = await fetch('/api/user/brush-presets');
          if (response.ok) {
            const data = await response.json();
              if (data.presets?.length > 0) {
                const mergedPresets = mergeWithDefaultPresets(data.presets);
                setPresets(mergedPresets);
                setRecentlyUsed(data.recentlyUsed || []);
                await settingsService.setSetting(SETTINGS_NAMESPACE, {
                  ...data,
                  presets: mergedPresets,
                });
                return;
              }
          } else if (response.status === 404) {
            markBrushPresetApiUnavailable('GET /api/user/brush-presets');
          }
        }
      } catch (error) {
        console.warn('Failed to load from database:', error);
      }

      const cached = await settingsService.getSetting<{ presets: BrushPreset[]; recentlyUsed: string[] }>(
        SETTINGS_NAMESPACE
      );
      if (cached?.presets?.length) {
        const mergedPresets = mergeWithDefaultPresets(cached.presets);
        setPresets(mergedPresets);
        setRecentlyUsed(cached.recentlyUsed || []);
        return;
      }

      const localRaw = localStorage.getItem(STORAGE_KEY);
      if (localRaw) {
        try {
          const local = JSON.parse(localRaw) as { presets?: BrushPreset[]; recentlyUsed?: string[] };
          if (Array.isArray(local.presets) && local.presets.length > 0) {
            const mergedPresets = mergeWithDefaultPresets(local.presets);
            setPresets(mergedPresets);
            setRecentlyUsed(Array.isArray(local.recentlyUsed) ? local.recentlyUsed : []);
            return;
          }
        } catch (error) {
          console.warn('Failed to parse local brush library cache:', error);
        }
      }

      setPresets(mergeWithDefaultPresets([]));
    };
    loadPresets();
  }, []);

  // Save to database with settings cache backup
  const save = useCallback(async () => {
    const data = { presets, recentlyUsed };

    await settingsService.setSetting(SETTINGS_NAMESPACE, data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // Try to save to database
    try {
      if (await checkBrushPresetApiAvailability()) {
        const response = await fetch('/api/user/brush-presets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (response.status === 404) {
          markBrushPresetApiUnavailable('PUT /api/user/brush-presets');
        }
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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamePresetName, setRenamePresetName] = useState('');
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
    onSaveCurrentBrush();
    setSaveDialogOpen(false);
    setNewPresetName('');
  }, [newPresetName, currentConfig, addPreset, onSaveCurrentBrush]);

  const handleDeletePreset = useCallback(() => {
    if (menuPresetId) {
      deletePreset(menuPresetId);
      setMenuAnchor(null);
      setMenuPresetId(null);
    }
  }, [menuPresetId, deletePreset]);

  const handleOpenRenamePreset = useCallback(() => {
    if (!menuPresetId) return;
    const preset = presets.find((item) => item.id === menuPresetId);
    if (!preset) return;
    setRenamePresetName(preset.name);
    setRenameDialogOpen(true);
    setMenuAnchor(null);
  }, [menuPresetId, presets]);

  const handleRenamePreset = useCallback(() => {
    if (!menuPresetId || !renamePresetName.trim()) return;
    updatePreset(menuPresetId, { name: renamePresetName.trim() });
    setRenameDialogOpen(false);
    setRenamePresetName('');
    setMenuPresetId(null);
  }, [menuPresetId, renamePresetName, updatePreset]);

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
              <IconButton
                size="small"
                onClick={() => {
                  onSaveCurrentBrush();
                  setSaveDialogOpen(true);
                }}
              >
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
        <MenuItem onClick={handleOpenRenamePreset} sx={{ fontSize: 12 }}>
          <Edit sx={{ fontSize: 14, mr: 1 }} /> Rename
        </MenuItem>
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
          <Button
            onClick={handleSavePreset}
            variant="contained"
            disabled={!newPresetName.trim()}
            startIcon={<Add />}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'rgba(30,30,40,0.98)', backgroundImage: 'none' } }}
      >
        <DialogTitle>Rename Brush Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Preset Name"
            value={renamePresetName}
            onChange={(event) => setRenamePresetName(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRenamePreset}
            variant="contained"
            disabled={!renamePresetName.trim()}
            startIcon={<Edit />}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </LibraryContainer>
  );
};

export default BrushLibrary;
