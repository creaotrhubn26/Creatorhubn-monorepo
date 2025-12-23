import * as React from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('AssetLibraryPanel, ');
import {
  Box,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Grid,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import {
  assetLibraryService,
  type AssetLibraryItem,
} from '@/core/services/assetLibrary';

// Category configuration with Norwegian labels
const CATEGORIES = {
  light: { label: 'Lys', icon: '💡' },
  light_shaper: { label: 'Lysformere', icon: '📦' },
  accessory: { label: 'Tilbehør', icon: '🔧' },
  prop: { label: 'Rekvisitter', icon: '🎭' },
  furniture: { label: 'Møbler', icon: '🪑' },
};

interface AssetCardProps {
  asset: AssetLibraryItem;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onPlaceManually?: (asset: AssetLibraryItem) => void;
}

function AssetCard({ asset, isFavorite, onToggleFavorite, onPlaceManually }: AssetCardProps) {
  const handleDoubleClick = () => {
    // Dispatch custom event to add asset to scene
    const event = new CustomEvent('ch-add-asset,', {
      detail: {
        asset: {
          id: asset.id,
          title: asset.name,
          type: asset.category === 'light' ? 'light' : 'model',
          thumbUrl: asset.thumbnail_url || '/library/generic.png',
          data: {
            modelUrl: asset.model_url,
            metadata: asset.metadata,
          },
        },
      },
    });
    window.dispatchEvent(event);

    // Track usage
    assetLibraryService.trackUsage(asset.id);
  };

  const handlePlaceManually = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlaceManually) {
      onPlaceManually(asset);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      , 'application/json',
      JSON.stringify({
        asset: {
          id: asset.id,
          title: asset.name,
          type: asset.category === 'light' ? 'light' : 'model',
          thumbUrl: asset.thumbnail_url,
          data: { modelUrl: asset.model_url, metadata: asset.metadata },
        },
      })
    );
  };

  // Get recommended patterns (if available)
  const recommendedPatterns = (asset as any).recommended_patterns || [];
  const hasPatterns = recommendedPatterns.length > 0;

  return (
    <Box
      onDoubleClick={handleDoubleClick}
      draggable
      onDragStart={handleDragStart}
      sx={{
        position: 'relative',
        cursor: 'pointer',
        border: '1px solid #e2e8f0',
        borderRadius: 1.5,
        overflow: 'hidden',
        bgcolor: '#fff', '&:hover': {
          transform: 'scale(1.02)',
          boxShadow: 2,
        },
        transition: 'all 0.2s'}}
    >
      <img
        src={asset.thumbnail_url || '/library/generic.png'}
        alt={asset.name}
        style={{
          width: '100%',
          height: 120,
          objectFit: 'cover',
          backgroundColor: '#f1f5f9'}}
      />

      {asset.is_system && (
        <Chip
          label="AI"
          size="small"
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            bgcolor: '#3B82F6',
            color: '#fff',
            fontSize: 10,
            height: 20,
            fontWeight: 600}}
        />
      )}

      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(asset.id);
        }}
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          bgcolor: 'rgba(255,255,255,0.9)','&:hover': { bgcolor: '#fff' }}}
      >
        {isFavorite ? (
          <StarIcon fontSize="small" sx={{ color: '#FCD34D' }} />
        ) : (
          <StarBorderIcon fontSize="small" />
        )}
      </IconButton>

      <Box sx={{ p: 1 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11,
            fontWeight: 50,
            mb: hasPatterns ? 0.5 : 0}}
        >
          {asset.name}
        </Typography>

        {/* Pattern Badges */}
        {hasPatterns && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center'}}
            >
              {recommendedPatterns.slice(0, 2).map((pattern: any) => (
                <Chip
                  key={pattern.pattern_id}
                  label={pattern.pattern_name}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: 8,
                    fontWeight: 50,
                    bgcolor:
                      pattern.recommendation_strength === 'essential'
                        ? '#10B981'
                        : pattern.recommendation_strength === 'recommended'
                        ? '#3B82F6'
                        : '#6B7280',
                    color: '#fff','& .MuiChip-label': { px: 0.5 }}}
                />
              ))}
              {recommendedPatterns.length > 2 && (
                <Typography
                  variant="caption"
                  sx={{ fontSize: 8, color: '#94A3B8' }}
                >
                  +{recommendedPatterns.length - 2}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* Manual Placement Button */}
        {onPlaceManually && (
          <Chip
            label="📍 Place"
            size="small"
            onClick={handlePlaceManually}
            sx={{
              mt: 0.5,
              height: 20,
              fontSize: 9,
              fontWeight: 50,
              bgcolor: '#F59E0B',
              color: '#fff',
              cursor: 'pointer',
              width: '100%','&:hover': { bgcolor: '#D97706' }, '& .MuiChip-label': { px: 0.5 }}}
          />
        )}
      </Box>
    </Box>
  );
}

// Manual Placement Dialog Component
interface ManualPlacementDialogProps {
  open: boolean;
  asset: AssetLibraryItem | null;
  onClose: () => void;
  onPlace: (position: [number, number, number]) => void;
}

function ManualPlacementDialog({
  open,
  asset,
  onClose,
  onPlace,
}: ManualPlacementDialogProps) {
  const [x, setX] = React.useState(0);
  const [y, setY] = React.useState(1.5);
  const [z, setZ] = React.useState(0);

  const handlePlace = () => {
    onPlace([x, y, z]);
    onClose();
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>📍 Place {asset.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Adjust the position where you want to place this asset in the 3D scene.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" gutterBottom>
            X Position (Left ← → Right): {x.toFixed(2)}m
          </Typography>
          <Slider
            value={x}
            onChange={(_, v) => setX(v as number)}
            min={-5}
            max={5}
            step={0.1}
            marks={[
              { value: -5, label: '-5m' },
              { value: 0, label: '0' },
              { value: 5, label: '5m' },
            ]}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" gutterBottom>
            Y Position (Down ↓ ↑ Up): {y.toFixed(2)}m
          </Typography>
          <Slider
            value={y}
            onChange={(_, v) => setY(v as number)}
            min={0}
            max={5}
            step={0.1}
            marks={[
              { value: 0, label: '0m' },
              { value: 1.5, label: '1.5m' },
              { value: 5, label: '5m' },
            ]}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" gutterBottom>
            Z Position (Back ← → Front): {z.toFixed(2)}m
          </Typography>
          <Slider
            value={z}
            onChange={(_, v) => setZ(v as number)}
            min={-5}
            max={5}
            step={0.1}
            marks={[
              { value: -5, label: '-5m' },
              { value: 0, label: '0' },
              { value: 5, label: '5m' },
            ]}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handlePlace} variant="contained" color="primary">
          Place Asset
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AssetLibraryPanel() {
  const [category, setCategory] = React.useState<string>('light');
  const [search, setSearch] = React.useState(', ');
  const [assets, setAssets] = React.useState<AssetLibraryItem[]>([]);
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [placementDialogOpen, setPlacementDialogOpen] = React.useState(false);
  const [selectedAsset, setSelectedAsset] = React.useState<AssetLibraryItem | null>(null);

  // Load assets when category or search changes
  const loadAssets = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await assetLibraryService.getAssets({
        category,
        search: search || undefined,
        is_system: true, // Only show AI-generated assets for now
        limit: 100,
      });
      setAssets(data);
    } catch (error) {
      log.error('Failed to load assets: ', error);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  // Load favorites on mount
  React.useEffect(() => {
    assetLibraryService.getFavorites().then(setFavorites);
  }, []);

  // Load assets when filters change
  React.useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleToggleFavorite = async (assetId: string) => {
    await assetLibraryService.toggleFavorite(assetId);
    const newFavorites = await assetLibraryService.getFavorites();
    setFavorites(newFavorites);
  };

  const handlePlaceManually = (asset: AssetLibraryItem) => {
    setSelectedAsset(asset);
    setPlacementDialogOpen(true);
  };

  const handlePlaceAsset = (position: [number, number, number]) => {
    if (!selectedAsset) return;

    // Dispatch custom event to add asset at specific position
    const event = new CustomEvent('ch-add-asset-at', {
      detail: {
        asset: {
          id: selectedAsset.id,
          title: selectedAsset.name,
          type: selectedAsset.category === 'light' ? 'light' : 'model',
          thumbUrl: selectedAsset.thumbnail_url || '/library/generic.png',
          data: {
            modelUrl: selectedAsset.model_url,
            metadata: selectedAsset.metadata,
          },
        },
        position,
      },
    });
    window.dispatchEvent(event);

    // Track usage
    assetLibraryService.trackUsage(selectedAsset.id);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600}}>
        📚 Asset Library
      </Typography>

      <Tabs
        value={category}
        onChange={(_, v) => setCategory(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, minHeight: 40 }}
      >
        {Object.entries(CATEGORIES).map(([key, { label, icon }]) => (
          <Tab
            key={key}
            value={key}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>{icon}</span>
                <span style={{ fontSize: 12 }}>{label}</span>
              </Box>
            }
            sx={{ minHeight: 40, py: 0.5 }}
          />
        ))}
      </Tabs>

      <TextField
        size="small"
        placeholder="Søk etter ressurser..."
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )}}
        sx={{ mb: 2 }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : assets.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          <Typography variant="body2">Ingen ressurser funnet</Typography>
          <Typography variant="caption">
            Prøv et annet søk eller kategori
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={1.5}>
          {assets.map((asset) => (
            <Grid item xs={6} key={asset.id}>
              <AssetCard
                asset={asset}
                isFavorite={favorites.includes(asset.id)}
                onToggleFavorite={handleToggleFavorite}
                onPlaceManually={handlePlaceManually}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && assets.length > 0 && (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 2, textAlign: 'center', color:'text.secondary' }}
        >
          {assets.length} ressurser
        </Typography>
      )}

      {/* Manual Placement Dialog */}
      <ManualPlacementDialog
        open={placementDialogOpen}
        asset={selectedAsset}
        onClose={() => setPlacementDialogOpen(false)}
        onPlace={handlePlaceAsset}
      />
    </Box>
  );
}

