import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Select,
  MenuItem,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type {
  LutSelection,
  LutTonalMix,
} from '../../lib/enhancer-session/module-contract';
import {
  fetchLutRegistry,
  type LutRegistryEntry,
} from '../../lib/enhancer-session/lut-registry';
// re-export for the props type consumers
export type { LutRegistryEntry };

const TONAL_MIX_OPTIONS: Array<{ value: LutTonalMix; label: string }> = [
  { value: 'all', label: 'Alt' },
  { value: 'highlights', label: 'Høylys' },
  { value: 'midtones', label: 'Mellomtoner' },
  { value: 'shadows', label: 'Skygger' },
];

const FAVORITES_KEY = 'creatorhub_lut_favorites_v1';

function readFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.map(String));
  } catch {
    // ignore — quota or SSR
  }
  return new Set();
}

function writeFavorites(ids: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export interface LUTPanelProps {
  value: LutSelection;
  onChange: (next: LutSelection) => void;
  onCommit?: (label?: string) => void;
  recentNames?: string[];
  onUpload?: (file: File) => Promise<void> | void;
  onDelete?: (lutId: string) => Promise<void> | void;
  /** Optional preview-rendered thumbnails keyed by LUT id. Used by the
   *  dropdown to show the active image through each LUT. */
  thumbnails?: Record<string, string>;
  onRegistryLoaded?: (entries: LutRegistryEntry[]) => void;
}

export function LUTPanel(props: LUTPanelProps) {
  const { value, onChange, onCommit, recentNames, onUpload, onDelete, thumbnails, onRegistryLoaded } = props;
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const ownerUserId = 'default';
  const registryQuery = useQuery<LutRegistryEntry[]>({
    queryKey: ['photo-enhancer-luts', ownerUserId],
    queryFn: () => fetchLutRegistry(ownerUserId),
    staleTime: 5 * 60 * 1000,
  });

  const registry = registryQuery.data ?? [];

  useEffect(() => {
    if (registry.length > 0) onRegistryLoaded?.(registry);
  }, [registry, onRegistryLoaded]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const entry of registry) {
      if (entry.category) set.add(entry.category);
    }
    return Array.from(set).sort();
  }, [registry]);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return registry;
    if (categoryFilter === 'favorites') return registry.filter((r) => favorites.has(r.id));
    if (categoryFilter === 'recent') {
      const set = new Set(recentNames ?? []);
      return registry.filter((r) => set.has(r.id));
    }
    return registry.filter((r) => r.category === categoryFilter);
  }, [registry, categoryFilter, favorites, recentNames]);

  const selected = registry.find((r) => r.id === value.name) ?? null;

  const toggleFavorite = (id: string) => {
    setFavorites((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeFavorites(next);
      return next;
    });
  };

  const selectLut = (id: string | null) => {
    const patch: LutSelection = {
      name: id,
      strength: id ? Math.max(value.strength, 50) : 0,
      tonalMix: value.tonalMix,
    };
    onChange(patch);
    onCommit?.(id ? `LUT: ${registry.find((r) => r.id === id)?.displayName ?? id}` : 'LUT: av');
  };

  const setStrength = (strength: number) => {
    onChange({ ...value, strength: Math.max(0, Math.min(100, strength)) });
  };

  const setTonalMix = (tonalMix: LutTonalMix) => {
    onChange({ ...value, tonalMix });
    onCommit?.(`LUT tonemiks: ${tonalMix}`);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      await onUpload(file);
      await registryQuery.refetch();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Opplasting feilet.');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    try {
      await onDelete(id);
      await registryQuery.refetch();
      if (value.name === id) selectLut(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Kunne ikke slette.');
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesomeIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2">LUT / look</Typography>
          {selected && (
            <Chip
              size="small"
              variant="outlined"
              label={`${selected.displayName} · ${Math.round(value.strength)}%`}
              color="primary"
            />
          )}
        </Stack>
        {onUpload && (
          <Tooltip title="Last opp .cube-fil">
            <span>
              <IconButton component="label" size="small" disabled={uploadBusy}>
                <UploadIcon fontSize="small" />
                <input
                  type="file"
                  hidden
                  accept=".cube"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void handleUpload(file);
                  }}
                />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>

      {registryQuery.isError && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Kunne ikke hente LUT-biblioteket.
        </Alert>
      )}
      {uploadError && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setUploadError(null)}>
          {uploadError}
        </Alert>
      )}

      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Chip
          size="small"
          label="Alle"
          clickable
          color={categoryFilter === 'all' ? 'primary' : 'default'}
          variant={categoryFilter === 'all' ? 'filled' : 'outlined'}
          onClick={() => setCategoryFilter('all')}
        />
        <Chip
          size="small"
          label="★ Favoritter"
          clickable
          color={categoryFilter === 'favorites' ? 'primary' : 'default'}
          variant={categoryFilter === 'favorites' ? 'filled' : 'outlined'}
          onClick={() => setCategoryFilter('favorites')}
          disabled={favorites.size === 0}
        />
        {recentNames && recentNames.length > 0 && (
          <Chip
            size="small"
            label="Nylig"
            clickable
            color={categoryFilter === 'recent' ? 'primary' : 'default'}
            variant={categoryFilter === 'recent' ? 'filled' : 'outlined'}
            onClick={() => setCategoryFilter('recent')}
          />
        )}
        {categories.map((cat) => (
          <Chip
            key={cat}
            size="small"
            label={cat}
            clickable
            color={categoryFilter === cat ? 'primary' : 'default'}
            variant={categoryFilter === cat ? 'filled' : 'outlined'}
            onClick={() => setCategoryFilter(cat)}
          />
        ))}
      </Stack>

      <FormControl fullWidth size="small">
        <InputLabel id="lut-select-label">Look</InputLabel>
        <Select
          labelId="lut-select-label"
          label="Look"
          value={value.name ?? ''}
          onChange={(event) => selectLut(event.target.value ? String(event.target.value) : null)}
          renderValue={(v) => {
            if (!v) return 'Ingen LUT';
            const entry = registry.find((r) => r.id === v);
            return entry ? entry.displayName : String(v);
          }}
        >
          <MenuItem value="">
            <em>Ingen LUT</em>
          </MenuItem>
          {filtered.map((entry) => (
            <MenuItem
              key={entry.id}
              value={entry.id}
              sx={{ alignItems: 'center', gap: 1 }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: `rgb(${entry.swatch.r}, ${entry.swatch.g}, ${entry.swatch.b})`,
                  backgroundImage: thumbnails?.[entry.id] ? `url(${thumbnails[entry.id]})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  flex: '0 0 auto',
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {entry.displayName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {entry.description}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFavorite(entry.id);
                }}
              >
                {favorites.has(entry.id) ? (
                  <StarIcon fontSize="inherit" sx={{ color: 'warning.main' }} />
                ) : (
                  <StarBorderIcon fontSize="inherit" />
                )}
              </IconButton>
              {entry.userUploaded && onDelete && (
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDelete(entry.id);
                  }}
                >
                  <DeleteIcon fontSize="inherit" />
                </IconButton>
              )}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {value.name && (
        <>
          <Box sx={{ mt: 1.25 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption">Styrke</Typography>
              <Typography variant="caption">{Math.round(value.strength)}%</Typography>
            </Stack>
            <Slider
              size="small"
              min={0}
              max={100}
              value={value.strength}
              onChange={(_, next) => setStrength(Array.isArray(next) ? next[0] : next)}
              onChangeCommitted={() => onCommit?.('LUT styrke')}
              onDoubleClick={() => {
                setStrength(0);
                onCommit?.('LUT styrke nullstilt');
              }}
            />
          </Box>

          <Box sx={{ mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              Påvirk bare
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={value.tonalMix}
              onChange={(_, next) => {
                if (!next) return;
                setTonalMix(next as LutTonalMix);
              }}
              sx={{ display: 'flex', mt: 0.25 }}
            >
              {TONAL_MIX_OPTIONS.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value} sx={{ flex: 1, fontSize: 11 }}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </>
      )}
    </Paper>
  );
}
