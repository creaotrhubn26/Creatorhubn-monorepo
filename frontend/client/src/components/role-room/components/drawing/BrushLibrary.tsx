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

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
import { BrushConfig, DEFAULT_BRUSH_CONFIG, AdvancedBrushType, AdvancedBrushEngine, hexToRgb } from './AdvancedBrushEngine';
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
    createdAt: 0,
  },
  {
    id: 'ink-pen',
    name: 'Fine Ink',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'ink', size: 1, color: '#000000', hardness: 0.9 },
    favorite: true,
    category: 'Drawing',
    icon: '🖊️',
    createdAt: 0,
  },
  {
    id: 'watercolor-wash',
    name: 'Watercolor Wash',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'watercolor', size: 30, color: '#3b82f6', wetness: 0.9, opacity: 0.4 },
    favorite: false,
    category: 'Painting',
    icon: '💧',
    createdAt: 0,
  },
  {
    id: 'thick-marker',
    name: 'Thick Marker',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'marker', size: 20, color: '#ef4444', opacity: 0.8 },
    favorite: false,
    category: 'Markers',
    icon: '🖍️',
    createdAt: 0,
  },
  {
    id: 'soft-brush',
    name: 'Soft Brush',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'brush', size: 25, color: '#22c55e', hardness: 0.3, opacity: 0.6 },
    favorite: false,
    category: 'Painting',
    icon: '🖌️',
    createdAt: 0,
  },
  {
    id: 'highlighter-yellow',
    name: 'Yellow Highlighter',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'highlighter', size: 15, color: '#fbbf24', opacity: 0.5 },
    favorite: false,
    category: 'Markers',
    icon: '💛',
    createdAt: 0,
  },
  {
    id: 'calligraphy',
    name: 'Calligraphy',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'pen', size: 6, color: '#1a1a2e', tiltSensitivity: 1, pressureSensitivity: 1 },
    favorite: true,
    category: 'Drawing',
    icon: '✒️',
    createdAt: 0,
  },
  {
    id: 'airbrush',
    name: 'Airbrush',
    config: { ...DEFAULT_BRUSH_CONFIG, type: 'brush', size: 40, color: '#8b5cf6', hardness: 0.1, flow: 0.3, opacity: 0.2 },
    favorite: false,
    category: 'Painting',
    icon: '🌫️',
    createdAt: 0,
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
  overflow: 'hidden',
});

// =============================================================================
// Live Brush Preview — renders a sample stroke on a 64×64 canvas
// =============================================================================

const previewCache = new Map<string, string>();

function renderBrushPreviewDataURL(config: BrushConfig): string {
  const key = JSON.stringify(config);
  const cached = previewCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') return '';

  const SIZE = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Semi-transparent bg so we can see stroke
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const engine = new AdvancedBrushEngine(ctx, config);

  // Draw an S-curve from bottom-left to top-right
  const points: { x: number; y: number; pressure: number; tiltX: number; tiltY: number; timestamp: number }[] = [];
  const STEPS = 24;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    points.push({
      x: 8 + t * (SIZE - 16),
      y: SIZE - 10 - Math.sin(t * Math.PI) * (SIZE - 24),
      pressure: 0.3 + Math.sin(t * Math.PI) * 0.6,
      tiltX: 0,
      tiltY: 0,
      timestamp: i,
    });
  }

  engine.startStroke(points[0]);
  for (let i = 1; i < points.length; i++) {
    engine.continueStroke(points[i]);
  }
  engine.endStroke();

  const url = canvas.toDataURL('image/png');
  // Cap cache at 100 entries
  if (previewCache.size > 100) {
    const first = previewCache.keys().next().value;
    if (first) previewCache.delete(first);
  }
  previewCache.set(key, url);
  return url;
}

/** Small component that shows a live canvas preview of a brush config */
const LiveBrushThumbnail: React.FC<{ config: BrushConfig }> = React.memo(({ config }) => {
  const dataUrl = useMemo(() => renderBrushPreviewDataURL(config), [config]);

  if (!dataUrl) return null;

  return (
    <Box
      component="img"
      src={dataUrl}
      alt="brush preview"
      sx={{
        width: 36,
        height: 36,
        borderRadius: '6px',
        objectFit: 'cover',
        imageRendering: 'smooth',
      }}
    />
  );
});

// =============================================================================
// Hooks
// =============================================================================

// Database availability cache — resets after 60 s to allow recovery
let dbAvailable: boolean | null = null;
let dbCheckedAt = 0;
const DB_CHECK_TTL = 60_000;

async function checkDatabaseAvailability(): Promise<boolean> {
  if (dbAvailable !== null && Date.now() - dbCheckedAt < DB_CHECK_TTL) return dbAvailable;
  try {
    const response = await fetch('/api/user/brush-presets', { method: 'HEAD' });
    dbAvailable = response.ok || response.status === 404; // endpoint exists
    dbCheckedAt = Date.now();
    return dbAvailable;
  } catch {
    dbAvailable = false;
    dbCheckedAt = Date.now();
    return false;
  }
}

function useBrushLibrary() {
  const [presets, setPresets] = useState<BrushPreset[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

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
              loadedRef.current = true;
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
        loadedRef.current = true;
        return;
      }

      setPresets(DEFAULT_PRESETS);
      loadedRef.current = true;
    };
    loadPresets();
  }, []);

  // Save to database with settings cache backup — debounced 600ms
  const persistNow = useCallback(async (data: { presets: BrushPreset[]; recentlyUsed: string[] }) => {
    await settingsService.setSetting(SETTINGS_NAMESPACE, data);
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
  }, []);

  // Debounced auto-save on state change
  useEffect(() => {
    if (!loadedRef.current || presets.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistNow({ presets, recentlyUsed });
    }, 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [presets, recentlyUsed, persistNow]);

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
    const envelope = {
      schemaVersion: 1,
      app: 'TheRollRoom',
      exportedAt: new Date().toISOString(),
      presets,
    };
    const data = JSON.stringify(envelope, null, 2);
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
        const raw = JSON.parse(e.target?.result as string);
        // Accept versioned envelope or bare array for back-compat
        const arr: unknown[] = Array.isArray(raw) ? raw : (raw?.presets ?? []);
        if (!Array.isArray(arr) || arr.length === 0) {
          console.error('Import failed: no presets found');
          return;
        }

        const BRUSH_TYPES: string[] = [
          'pencil', 'pen', 'marker', 'brush', 'watercolor', 'ink', 'highlighter', 'eraser',
        ];

        const validated = arr
          .slice(0, 200) // cap at 200 presets
          .filter((p): p is Record<string, unknown> =>
            p !== null && typeof p === 'object' && typeof (p as Record<string, unknown>).name === 'string'
          )
          .map((p) => {
            const cfg = (p.config && typeof p.config === 'object' ? p.config : {}) as Record<string, unknown>;
            return {
              id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              name: String(p.name).slice(0, 100),
              config: {
                ...DEFAULT_BRUSH_CONFIG,
                type: (BRUSH_TYPES.includes(String(cfg.type)) ? String(cfg.type) : 'pen') as AdvancedBrushType,
                size: Math.max(0.5, Math.min(200, Number(cfg.size) || DEFAULT_BRUSH_CONFIG.size)),
                color: typeof cfg.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(cfg.color) ? cfg.color : DEFAULT_BRUSH_CONFIG.color,
                opacity: Math.max(0, Math.min(1, Number(cfg.opacity) || DEFAULT_BRUSH_CONFIG.opacity)),
                hardness: Math.max(0, Math.min(1, Number(cfg.hardness) || DEFAULT_BRUSH_CONFIG.hardness)),
                flow: Math.max(0, Math.min(1, Number(cfg.flow) || DEFAULT_BRUSH_CONFIG.flow)),
                wetness: Math.max(0, Math.min(1, Number(cfg.wetness) || DEFAULT_BRUSH_CONFIG.wetness)),
                grain: Math.max(0, Math.min(1, Number(cfg.grain) || DEFAULT_BRUSH_CONFIG.grain)),
                tiltSensitivity: Math.max(0, Math.min(1, Number(cfg.tiltSensitivity) || DEFAULT_BRUSH_CONFIG.tiltSensitivity)),
                pressureSensitivity: Math.max(0, Math.min(1, Number(cfg.pressureSensitivity) || DEFAULT_BRUSH_CONFIG.pressureSensitivity)),
              },
              favorite: Boolean(p.favorite),
              category: 'Custom',
              icon: typeof p.icon === 'string' ? p.icon.slice(0, 4) : '🎨',
              createdAt: Date.now(),
            } satisfies BrushPreset;
          });

        if (validated.length > 0) {
          setPresets(prev => [...prev, ...validated]);
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
    onSaveCurrentBrush();
  }, [newPresetName, currentConfig, addPreset, onSaveCurrentBrush]);

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
                <LiveBrushThumbnail config={preset.config} />
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
              <LiveBrushThumbnail config={preset.config} />
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
