/**
 * Modifier Browser
 * Browse and add lighting modifiers to the scene
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('ModifierBrowser, ');
import {
  Box,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Grid,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Stack,
  Tooltip,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  modifierLibrary,
  Modifier,
  getAllModifiers,
  getModifiersByType,
  getModifiersByBrand,
  searchModifiers,
} from '@/core/data/ModifierLibrary';
import { AssetLoader } from '@/core/loaders/AssetLoader';
import { useActions } from '@/state/selectors';

export default function ModifierBrowser() {
  const { addNode } = useActions();
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [filteredModifiers, setFilteredModifiers] = useState<Modifier[]>([]);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>(', ');
  const [loading, setLoading] = useState<boolean>(true);

  // Load modifier metadata on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await modifierLibrary.loadMetadata();
      const allModifiers = getAllModifiers();
      setModifiers(allModifiers);
      setFilteredModifiers(allModifiers);
      setLoading(false);
    };
    loadData();
  }, []);

  // Filter modifiers based on tab and search
  useEffect(() => {
    let filtered = modifiers;

    // Filter by type (tab)
    if (selectedTab === 1) {
      filtered = getModifiersByType('beauty-dish');
    } else if (selectedTab === 2) {
      filtered = getModifiersByType('softbox');
    } else if (selectedTab === 3) {
      filtered = getModifiersByType('stripbox');
    } else if (selectedTab === 4) {
      filtered = getModifiersByType('octabox');
    } else if (selectedTab === 5) {
      filtered = getModifiersByType('reflector');
    }

    // Filter by search query
    if (searchQuery) {
      filtered = searchModifiers(searchQuery);
    }

    setFilteredModifiers(filtered);
  }, [selectedTab, searchQuery, modifiers]);

  // Handle adding modifier to scene
  const handleAddModifier = async (modifier: Modifier) => {
    try {
      log.debug(`Loading modifier: ${modifier.name}`);

      // Load 3D model
      const assetLoader = AssetLoader.getInstance();
      const model = await assetLoader.loadModel(modifier.files.glb, {
        cacheable: true,
        generateLODs: true,
      });

      // Add to scene via store
      addNode({
        type: 'prop',
        name: modifier.name,
        transform: {
          position: [0, 1.5, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
        userData: {
          modifierId: modifier.id,
          modifierType: modifier.type,
          brand: modifier.brand,
          model: model,
        },
      });

      log.debug(`Added modifier: ${modifier.name}`);
    } catch (error) {
      log.error(`Failed to load modifier: ${modifier.name}`, error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading modifiers...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Modifier Library
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search modifiers..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )}}
        sx={{ mb: 2 }}
      />

      {/* Tabs */}
      <Tabs
        value={selectedTab}
        onChange={(_, newValue) => setSelectedTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="All" />
        <Tab label="Beauty Dish" />
        <Tab label="Softbox" />
        <Tab label="Stripbox" />
        <Tab label="Octabox" />
        <Tab label="Reflector" />
      </Tabs>

      {/* Modifier Grid */}
      <Grid container spacing={2}>
        {filteredModifiers.map((modifier) => (
          <Grid item xs={12} sm={6} md={4} key={modifier.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column','&:hover': {
                  boxShadow: 4,
                  cursor: 'pointer',
                }}}
            >
              <CardMedia
                component="img"
                height="180"
                image={modifier.files.thumbnail}
                alt={modifier.name}
                sx={{ objectFit: 'contain', bgcolor: '#f5f5f5', p: 1 }}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                  <Chip label={modifier.brand} size="small" color="primary" />
                  <Chip label={modifier.type} size="small" variant="outlined" />
                </Stack>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {modifier.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {modifier.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => handleAddModifier(modifier)}
                  fullWidth
                  variant="contained"
                >
                  Add to Scene
                </Button>
                <Tooltip
                  title={
                    <Box>
                      <Typography variant="caption">
                        <strong>Dimensions:</strong>{', '}
                        {modifier.dimensions.diameter
                          ? `Ø${modifier.dimensions.diameter}m`
                          : `${modifier.dimensions.width}x${modifier.dimensions.height}m`}
                      </Typography>
                      <br />
                      <Typography variant="caption">
                        <strong>Mount:</strong> {modifier.mount_type}
                      </Typography>
                      <br />
                      <Typography variant="caption">
                        <strong>Weight:</strong> {modifier.weight_kg}kg
                      </Typography>
                    </Box>
                  }
                >
                  <IconButton size="small">
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredModifiers.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">No modifiers found</Typography>
        </Box>
      )}
    </Box>
  );
}

