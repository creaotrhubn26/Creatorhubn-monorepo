/**
 * Asset Library Panel
 * 
 * Panel for browsing and adding 2D assets to the shot planner.
 * Supports drag-and-drop to canvas.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Tooltip,
  Chip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Chair as FurnitureIcon,
  Person as ActorIcon,
  Videocam as CameraIcon,
  DirectionsCar as VehicleIcon,
  Park as NatureIcon,
  Lightbulb as PropIcon,
  Build as EquipmentIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import {
  ASSET_LIBRARY,
  ALL_ASSETS,
  searchAssets,
  getAssetCategories,
  ASSET_ICONS,
} from './assetLibrary';
import { generateThumbnail, getCachedThumbnail, preGenerateAllThumbnails } from './pixiThumbnailer';
import { Asset2DDefinition, AssetType } from './types';
import { useShotPlannerStore } from './store';

// =============================================================================
// Tab Configuration
// =============================================================================

const ASSET_TABS: { type: AssetType | 'all'; label: string; icon: React.ReactElement }[] = [
  { type: 'all', label: 'All', icon: <SearchIcon /> },
  { type: 'furniture', label: 'Furniture', icon: <FurnitureIcon /> },
  { type: 'actor', label: 'Actors', icon: <ActorIcon /> },
  { type: 'camera', label: 'Cameras', icon: <CameraIcon /> },
  { type: 'prop', label: 'Props', icon: <PropIcon /> },
  { type: 'vehicle', label: 'Vehicles', icon: <VehicleIcon /> },
  { type: 'nature', label: 'Nature', icon: <NatureIcon /> },
];

// =============================================================================
// Asset Card Component
// =============================================================================

interface AssetCardProps {
  asset: Asset2DDefinition;
  onAdd: (asset: Asset2DDefinition) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onAdd }) => {
  const thumbUrl = asset.thumbnailUrl || getCachedThumbnail(asset.id);

  return (
    <Card
      sx={{
        backgroundColor: '#2A3F4F',
        borderRadius: 1,
        '&:hover': {
          backgroundColor: '#3A4F5F',
          transform: 'scale(1.02)',
        },
        transition: 'all 0.2s',
        cursor: 'grab',
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(asset));
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <CardActionArea onClick={() => onAdd(asset)}>
        <CardContent sx={{ p: 1.5 }}>
          {/* Asset Preview */}
          <Box
            sx={{
              width: '100%',
              height: 50,
              backgroundColor: asset.defaultColor,
              borderRadius: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1,
              opacity: 0.8,
            }}
          >
            {thumbUrl ? (
              <img src={thumbUrl} alt={asset.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <> 
                {asset.type === 'actor' && <ActorIcon sx={{ color: '#FFF', fontSize: 28 }} />}
                {asset.type === 'camera' && <CameraIcon sx={{ color: '#FFF', fontSize: 28 }} />}
                {asset.type === 'vehicle' && <VehicleIcon sx={{ color: '#FFF', fontSize: 28 }} />}
                {asset.type === 'furniture' && <FurnitureIcon sx={{ color: '#FFF', fontSize: 28 }} />}
                {asset.type === 'prop' && <PropIcon sx={{ color: '#FFF', fontSize: 28 }} />}
                {asset.type === 'nature' && <NatureIcon sx={{ color: '#FFF', fontSize: 28 }} />}
              </>
            )}
          </Box>
          
          {/* Asset Name */}
          <Typography
            variant="caption"
            sx={{
              color: '#FFFFFF',
              display: 'block',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {asset.name}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// =============================================================================
// Category Section Component
// =============================================================================

interface CategorySectionProps {
  category: string;
  assets: Asset2DDefinition[];
  onAdd: (asset: Asset2DDefinition) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  assets,
  onAdd,
}) => {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <Box sx={{ mb: 2 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          py: 0.5,
          px: 1,
          borderRadius: 0.5,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
        }}
      >
        <Typography variant="caption" sx={{ color: '#8896A6', fontWeight: 600 }}>
          {category} ({assets.length})
        </Typography>
        {expanded ? (
          <CollapseIcon sx={{ color: '#8896A6', fontSize: 18 }} />
        ) : (
          <ExpandIcon sx={{ color: '#8896A6', fontSize: 18 }} />
        )}
      </Box>
      
      <Collapse in={expanded}>
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          {assets.map(asset => (
            <Grid size={{ xs: 6 }} key={asset.id}>
              <AssetCard asset={asset} onAdd={onAdd} />
            </Grid>
          ))}
        </Grid>
      </Collapse>
    </Box>
  );
};

// =============================================================================
// Main Component
// =============================================================================

interface AssetLibraryPanelProps {
  onAssetAdd?: (asset: Asset2DDefinition) => void;
}

export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({ onAssetAdd }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AssetType | 'all'>('all');
  const [thumbsLoading, setThumbsLoading] = useState(true);
  
  const { addCamera, addActor, addProp, scene } = useShotPlannerStore();
  
  // Pre-generate all thumbnails on mount
  useEffect(() => {
    let mounted = true;
    preGenerateAllThumbnails(ALL_ASSETS, 128)
      .then(() => {
        if (mounted) setThumbsLoading(false);
      })
      .catch(() => {
        if (mounted) setThumbsLoading(false);
      });
    return () => { mounted = false; };
  }, []);
  
  // Filter assets based on search and tab
  const filteredAssets = useMemo(() => {
    let assets: Asset2DDefinition[] = [];
    
    if (activeTab === 'all') {
      assets = [
        ...ASSET_LIBRARY.furniture,
        ...ASSET_LIBRARY.props,
        ...ASSET_LIBRARY.actors,
        ...ASSET_LIBRARY.cameras,
        ...ASSET_LIBRARY.vehicles,
        ...ASSET_LIBRARY.nature,
        ...ASSET_LIBRARY.architectural,
        ...ASSET_LIBRARY.equipment,
      ];
    } else {
      switch (activeTab) {
        case 'furniture':
          assets = [...ASSET_LIBRARY.furniture, ...ASSET_LIBRARY.architectural];
          break;
        case 'actor':
          assets = ASSET_LIBRARY.actors;
          break;
        case 'camera':
          assets = ASSET_LIBRARY.cameras;
          break;
        case 'prop':
          assets = [...ASSET_LIBRARY.props, ...ASSET_LIBRARY.equipment];
          break;
        case 'vehicle':
          assets = ASSET_LIBRARY.vehicles;
          break;
        case 'nature':
          assets = ASSET_LIBRARY.nature;
          break;
        default:
          assets = [];
      }
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      assets = assets.filter(
        asset =>
          asset.name.toLowerCase().includes(query) ||
          asset.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return assets;
  }, [activeTab, searchQuery]);
  
  // Group assets by category
  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset2DDefinition[]> = {};
    
    filteredAssets.forEach(asset => {
      if (!groups[asset.category]) {
        groups[asset.category] = [];
      }
      groups[asset.category].push(asset);
    });
    
    return groups;
  }, [filteredAssets]);
  
  // Handle adding asset to scene
  const handleAddAsset = (asset: Asset2DDefinition) => {
    if (!scene) return;
    
    // Add at center of viewport
    const centerX = (400 - scene.viewport.offset.x) / scene.viewport.zoom;
    const centerY = (300 - scene.viewport.offset.y) / scene.viewport.zoom;
    
    if (asset.type === 'camera') {
      addCamera({ x: centerX, y: centerY }, asset.name);
    } else if (asset.type === 'actor') {
      addActor({ x: centerX, y: centerY }, asset.name);
    } else {
      addProp({ x: centerX, y: centerY }, asset.name, asset.category);
    }
    
    onAssetAdd?.(asset);
  };
  
  return (
    <Paper
      sx={{
        height: '100%',
        backgroundColor: '#1E2D3D',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #3A4A5A' }}>
        <Typography variant="subtitle1" sx={{ color: '#FFFFFF', fontWeight: 600, mb: 1.5 }}>
          Asset Library
        </Typography>
        
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#8896A6' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#0A1929',
              color: '#FFFFFF',
              '& fieldset': { borderColor: '#3A4A5A' },
              '&:hover fieldset': { borderColor: '#4FC3F7' },
            },
          }}
        />
      </Box>
      
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: '1px solid #3A4A5A',
          minHeight: 40,
          '& .MuiTab-root': {
            color: '#8896A6',
            minHeight: 40,
            minWidth: 'auto',
            px: 1.5,
            '&.Mui-selected': { color: '#4FC3F7' },
          },
          '& .MuiTabs-indicator': { backgroundColor: '#4FC3F7' },
        }}
      >
        {ASSET_TABS.map(tab => (
          <Tab
            key={tab.type}
            value={tab.type}
            icon={tab.icon}
            iconPosition="start"
            label={tab.label}
            sx={{ fontSize: 12 }}
          />
        ))}
      </Tabs>
      
      {/* Asset Grid */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {Object.entries(groupedAssets).map(([category, assets]) => (
          <CategorySection
            key={category}
            category={category}
            assets={assets}
            onAdd={handleAddAsset}
          />
        ))}
        
        {filteredAssets.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              color: '#8896A6',
            }}
          >
            <SearchIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">No assets found</Typography>
          </Box>
        )}
      </Box>
      
      {/* Instructions */}
      <Box
        sx={{
          p: 1.5,
          borderTop: '1px solid #3A4A5A',
          backgroundColor: '#0A1929',
        }}
      >
        <Typography variant="caption" sx={{ color: '#8896A6' }}>
          💡 Click to add or drag & drop onto canvas
        </Typography>
      </Box>
    </Paper>
  );
};

export default AssetLibraryPanel;
