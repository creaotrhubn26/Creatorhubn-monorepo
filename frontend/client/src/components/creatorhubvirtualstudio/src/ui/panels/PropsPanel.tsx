/**
 * Props Panel
 * 
 * UI for selecting and placing props (furniture, objects, decorations) in the scene.
 * Integrates with propRenderingService for optimized loading with automatic LOD and GPU instancing.
 * 
 * Features:
 * - Category selection (furniture, electronics, decorations, tools, vehicles, nature, architecture, lighting)
 * - Props grid with previews
 * - Transform controls (position, rotation, scale)
 * - Shadow controls
 * - LOD and GPU instancing options
 * - "Create Forest" helper for nature props
 * - Add to scene functionality
 */

import React, { useState, useMemo } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('PropsPanel');
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Slider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import {
  Category,
  Add,
  ExpandMore,
  Tune,
  Park,
} from '@mui/icons-material';
import { useAppStore } from '../../state/store';
import {
  ALL_PROPS,
  PROPS_BY_CATEGORY,
  PropCategory,
} from '../../core/data/propDefinitions';

export const PropsPanel: React.FC = () => {
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PropsPanel.tsx:55',message:'PropsPanel rendered',data:{panelName:'PropsPanel'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  }, []);
  // #endregion
  const { addNode } = useAppStore();

  // UI State
  const [activeCategory, setActiveCategory] = useState<PropCategory>('furniture');
  const [selectedProp, setSelectedProp] = useState<string | null>(null);
  
  // Transform State
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [posZ, setPosZ] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [scale, setScale] = useState(1.0);
  
  // Options State
  const [castShadow, setCastShadow] = useState(true);
  const [receiveShadow, setReceiveShadow] = useState(true);
  const [enableLOD, setEnableLOD] = useState(true);
  const [enableGPUInstancing, setEnableGPUInstancing] = useState(false);
  const [maxInstances, setMaxInstances] = useState(100);

  // Get props for active category
  const propItems = useMemo(() => {
    return PROPS_BY_CATEGORY[activeCategory] || [];
  }, [activeCategory]);

  const handleAddProp = () => {
    if (!selectedProp) return;

    const prop = ALL_PROPS.find(p => p.id === selectedProp);
    if (!prop) return;

    // Add prop node to scene
    const propId = `prop-${Date.now()}`;
    addNode({
      id: propId,
      type: 'prop',
      name: `${prop.name} (${prop.category})`,
      transform: {
        position: [posX, posY, posZ],
        rotation: [0, rotY, 0],
        scale: [scale, scale, scale],
      },
      visible: true,
      userData: {
        propId: selectedProp,
        propScale: scale,
        castShadow,
        receiveShadow,
        enableLOD,
        enableGPUInstancing,
        maxInstances: enableGPUInstancing ? maxInstances : undefined,
        enableFrustumCulling: true,
        enableOcclusionCulling: false,
      },
    });

    log.debug('Prop added: ', {
      id: propId,
      prop: prop.name,
      position: [posX, posY, posZ],
      scale,
    });
  };

  const handleCreateForest = () => {
    if (!selectedProp) return;

    const prop = ALL_PROPS.find(p => p.id === selectedProp);
    if (!prop || prop.category !== 'nature') {
      alert('Please select a nature prop (tree, rock, plant) to create a forest');
      return;
    }

    // Add forest node to scene
    const forestId = `forest-${Date.now()}`;
    addNode({
      id: forestId,
      type: 'prop',
      name: `Forest (${prop.name})`,
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      visible: true,
      userData: {
        propId: selectedProp,
        propScale: 1.0,
        castShadow: true,
        receiveShadow: true,
        enableLOD: true,
        enableGPUInstancing: true,
        maxInstances: 5000,
        enableFrustumCulling: true,
        enableOcclusionCulling: true,
        isForest: true,
        forestArea: { width: 100, depth: 100 },
      },
    });

    log.debug('Forest created:', {
      id: forestId,
      prop: prop.name,
      instances: 5000,
    });
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Category />
        Props Library
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add furniture, objects, and decorations to your scene with automatic LOD and GPU instancing.
      </Typography>

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onChange={(_, value) => setActiveCategory(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="furniture" label="Furniture" />
        <Tab value="electronics" label="Electronics" />
        <Tab value="decorations" label="Decorations" />
        <Tab value="tools" label="Tools" />
        <Tab value="vehicles" label="Vehicles" />
        <Tab value="nature" label="Nature" />
        <Tab value="architecture" label="Architecture" />
        <Tab value="lighting" label="Lighting" />
      </Tabs>

      {/* Props Grid */}
      <Box sx={{ maxHeight: 300, overflowY: 'auto', mb: 2 }}>
        {propItems.length === 0 ? (
          <Alert severity="info">
            No props available in this category yet.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {propItems.map((prop) => (
              <Grid item xs={12} sm={6} key={prop.id}>
                <Card
                  sx={{
                    backgroundColor: selectedProp === prop.id ? '#333' : '#2a2a2a', '&:hover': { backgroundColor: '#333' },
                    cursor: 'pointer',
                    border: selectedProp === prop.id ? '2px solid #2196f3' : 'none'}}
                  onClick={() => setSelectedProp(prop.id)}
                >
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {prop.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {prop.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={prop.size} size="small" />
                      <Chip label={prop.complexity} size="small" />
                      {prop.supportsLOD && <Chip label="LOD" size="small" color="success" />}
                      {prop.supportsInstancing && <Chip label="GPU" size="small" color="success" />}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Transform & Options Accordion */}
      <Accordion defaultExpanded sx={{ backgroundColor: '#2a2a2a', mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tune />
            Transform & Options
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Position Controls */}
          <Typography variant="subtitle2" gutterBottom>
            Position
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="X"
              type="number"
              value={posX}
              onChange={(e) => setPosX(parseFloat(e.target.value) || 0)}
              size="small"
              fullWidth
            />
            <TextField
              label="Y"
              type="number"
              value={posY}
              onChange={(e) => setPosY(parseFloat(e.target.value) || 0)}
              size="small"
              fullWidth
            />
            <TextField
              label="Z"
              type="number"
              value={posZ}
              onChange={(e) => setPosZ(parseFloat(e.target.value) || 0)}
              size="small"
              fullWidth
            />
          </Box>

          {/* Rotation & Scale */}
          <Typography variant="caption">Rotation Y: {rotY}°</Typography>
          <Slider
            value={rotY}
            onChange={(_, value) => setRotY(value as number)}
            min={0}
            max={360}
            sx={{ mb: 2 }}
          />
          <Typography variant="caption">Scale: {scale.toFixed(2)}</Typography>
          <Slider
            value={scale}
            onChange={(_, value) => setScale(value as number)}
            min={0.1}
            max={5}
            step={0.1}
            sx={{ mb: 2 }}
          />

          {/* Options */}
          <Typography variant="subtitle2" gutterBottom>
            Options
          </Typography>
          <FormControlLabel
            control={<Switch checked={castShadow} onChange={(e) => setCastShadow(e.target.checked)} />}
            label="Cast Shadow"
          />
          <FormControlLabel
            control={<Switch checked={receiveShadow} onChange={(e) => setReceiveShadow(e.target.checked)} />}
            label="Receive Shadow"
          />
          <FormControlLabel
            control={<Switch checked={enableLOD} onChange={(e) => setEnableLOD(e.target.checked)} />}
            label="Enable LOD"
          />
          <FormControlLabel
            control={<Switch checked={enableGPUInstancing} onChange={(e) => setEnableGPUInstancing(e.target.checked)} />}
            label="GPU Instancing"
          />
          {enableGPUInstancing && (
            <TextField
              label="Max Instances"
              type="number"
              value={maxInstances}
              onChange={(e) => setMaxInstances(parseInt(e.target.value) || 100)}
              size="small"
              fullWidth
              sx={{ mt: 1 }}
            />
          )}
        </AccordionDetails>
      </Accordion>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<Add />}
          onClick={handleAddProp}
          disabled={!selectedProp}
        >
          Add Prop
        </Button>
        {activeCategory ==='nature' && (
          <Button
            variant="outlined"
            fullWidth
            startIcon={<Park />}
            onClick={handleCreateForest}
            disabled={!selectedProp}
          >
            Create Forest
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default PropsPanel;

