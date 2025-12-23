/**
 * Clothing Panel
 * 
 * UI for selecting and customizing clothing for virtual actors.
 * Integrates with clothingRenderingService for optimized loading.
 * 
 * Features:
 * - Category selection (tops, bottoms, dresses, outerwear, footwear, accessories)
 * - Clothing grid with previews
 * - Color customization (HSL)
 * - Fabric customization (roughness, metalness)
 * - Actor selection
 * - Add to actor functionality
 * - LOD support
 */

import React, { useState, useMemo } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('ClothingPanel');
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Checkroom,
  Add,
  ExpandMore,
  Palette,
} from '@mui/icons-material';
import { useAppStore } from '../../state/store';
import {
  ALL_CLOTHING_STYLES,
  CLOTHING_BY_CATEGORY,
  ClothingStyleDefinition,
  ClothingCategory,
} from '../../core/data/clothingStyles';

export const ClothingPanel: React.FC = () => {
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClothingPanel.tsx:57',message:'ClothingPanel rendered',data:{panelName:'ClothingPanel'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  }, []);
  // #endregion
  const { addNode } = useAppStore();
  const nodes = useAppStore((s) => s.scene.nodes);

  // UI State
  const [activeCategory, setActiveCategory] = useState<ClothingCategory>('tops');
  const [selectedClothing, setSelectedClothing] = useState<string | null>(null);
  const [selectedActor, setSelectedActor] = useState<string>('');
  
  // Customization State
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(50);
  const [lightness, setLightness] = useState(50);
  const [roughness, setRoughness] = useState(0.8);
  const [metalness, setMetalness] = useState(0.0);
  const [enableLOD, setEnableLOD] = useState(true);

  // Get actors from scene
  const actors = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClothingPanel.tsx:79',message:'Filtering actors',data:{nodesType:typeof nodes,nodesIsArray:Array.isArray(nodes),nodesLength:nodes?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (!nodes || !Array.isArray(nodes)) return [];
    return nodes.filter(node => node.type === 'model' || node.type === 'virtual');
  }, [nodes]);

  // Get clothing for active category
  const clothingItems = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClothingPanel.tsx:84',message:'Getting clothing items',data:{activeCategory,hasCLOTHING_BY_CATEGORY:!!CLOTHING_BY_CATEGORY,clothingByCategoryType:typeof CLOTHING_BY_CATEGORY,hasCategory:!!CLOTHING_BY_CATEGORY?.[activeCategory]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (!CLOTHING_BY_CATEGORY || !CLOTHING_BY_CATEGORY[activeCategory]) return [];
    return CLOTHING_BY_CATEGORY[activeCategory] || [];
  }, [activeCategory]);

  const handleAddClothing = () => {
    if (!selectedClothing || !selectedActor) {
      return;
    }

    const clothing = ALL_CLOTHING_STYLES.find(c => c.id === selectedClothing);
    if (!clothing) return;

    // Add clothing node to scene
    const clothingId = `clothing-${Date.now()}`;
    addNode({
      id: clothingId,
      type: 'clothing',
      name: `${clothing.name} (${clothing.category})`,
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      visible: true,
      userData: {
        parentActorId: selectedActor,
        clothingStyleId: selectedClothing,
        clothingColor: {
          hue,
          saturation: saturation / 100,
          lightness: lightness / 100,
        },
        clothingScale: 1.0,
        clothingOffset: { x: 0, y: 0, z: 0 },
        roughness,
        metalness,
        enableLOD,
      },
    });

    log.debug('Clothing added: ', {
      id: clothingId,
      clothing: clothing.name,
      actor: selectedActor,
      color: { hue, saturation, lightness },
    });
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Checkroom />
        Clothing Library
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select and customize clothing for virtual actors with fabric and color controls.
      </Typography>

      {actors.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No actors in scene. Add a virtual actor first to apply clothing.
        </Alert>
      )}

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onChange={(_, value) => setActiveCategory(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="tops" label="Tops" />
        <Tab value="bottoms" label="Bottoms" />
        <Tab value="dresses" label="Dresses" />
        <Tab value="outerwear" label="Outerwear" />
        <Tab value="footwear" label="Footwear" />
        <Tab value="accessories" label="Accessories" />
      </Tabs>

      {/* Clothing Grid */}
      <Box sx={{ maxHeight: 300, overflowY: 'auto', mb: 2 }}>
        {clothingItems.length === 0 ? (
          <Alert severity="info">
            No clothing items available in this category yet.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {clothingItems.map((clothing) => (
              <Grid item xs={12} sm={6} key={clothing.id}>
                <Card
                  sx={{
                    backgroundColor: selectedClothing === clothing.id ? '#333' : '#2a2a2a', '&:hover': { backgroundColor: '#333' },
                    cursor: 'pointer',
                    border: selectedClothing === clothing.id ? '2px solid #2196f3' : 'none'}}
                  onClick={() => setSelectedClothing(clothing.id)}
                >
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {clothing.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {clothing.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={clothing.style} size="small" />
                      <Chip label={clothing.formality} size="small" />
                      <Chip label={clothing.gender} size="small" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Customization Accordion */}
      <Accordion defaultExpanded sx={{ backgroundColor: '#2a2a2a', mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography sx={{ display: 'flex', alignItems:'center', gap: 1 }}>
            <Palette />
            Color & Fabric Customization
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Actor Selection */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Select Actor</InputLabel>
            <Select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              label="Select Actor"
            >
              {actors.map((actor) => (
                <MenuItem key={actor.id} value={actor.id}>
                  {actor.name || actor.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Color Controls */}
          <Typography variant="subtitle2" gutterBottom>
            Color (HSL)
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Hue: {hue}°</Typography>
            <Slider
              value={hue}
              onChange={(_, value) => setHue(value as number)}
              min={0}
              max={360}
              sx={{ mb: 1 }}
            />
            <Typography variant="caption">Saturation: {saturation}%</Typography>
            <Slider
              value={saturation}
              onChange={(_, value) => setSaturation(value as number)}
              min={0}
              max={100}
              sx={{ mb: 1 }}
            />
            <Typography variant="caption">Lightness: {lightness}%</Typography>
            <Slider
              value={lightness}
              onChange={(_, value) => setLightness(value as number)}
              min={0}
              max={100}
            />
          </Box>

          {/* Fabric Controls */}
          <Typography variant="subtitle2" gutterBottom>
            Fabric Properties
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Roughness: {roughness.toFixed(2)}</Typography>
            <Slider
              value={roughness}
              onChange={(_, value) => setRoughness(value as number)}
              min={0}
              max={1}
              step={0.01}
              sx={{ mb: 1 }}
            />
            <Typography variant="caption">Metalness: {metalness.toFixed(2)}</Typography>
            <Slider
              value={metalness}
              onChange={(_, value) => setMetalness(value as number)}
              min={0}
              max={1}
              step={0.01}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Add Button */}
      <Button
        variant="contained"
        fullWidth
        startIcon={<Add />}
        onClick={handleAddClothing}
        disabled={!selectedClothing || !selectedActor}
      >
        Add Clothing to Actor
      </Button>
    </Paper>
  );
};

export default ClothingPanel;

