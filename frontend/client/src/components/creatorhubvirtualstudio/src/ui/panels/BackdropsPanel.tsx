/**
 * Backdrops Panel
 * 
 * UI for selecting and configuring backdrops/environments in the scene.
 * Integrates with backdropRenderingService for environment maps and ambient lighting.
 * 
 * Features:
 * - Category selection (studio, outdoor, indoor, abstract, green-screen, skybox, cyclorama)
 * - Backdrops grid with previews
 * - Environment map toggle
 * - Ambient lighting controls
 * - Scale controls
 * - Set backdrop functionality
 * - Remove backdrop functionality
 */

import React, { useState, useMemo } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('BackdropsPanel');
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
} from '@mui/material';
import {
  Landscape,
  Add,
  Delete,
  ExpandMore,
  Tune,
  WbSunny,
} from '@mui/icons-material';
import { useAppStore } from '../../state/store';
import {
  ALL_BACKDROPS,
  BACKDROPS_BY_CATEGORY,
  BackdropCategory,
} from '../../core/data/backdropDefinitions';

export const BackdropsPanel: React.FC = () => {
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BackdropsPanel.tsx:55',message:'BackdropsPanel rendered',data:{panelName:'BackdropsPanel'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  }, []);
  // #endregion
  const { addNode, removeNode } = useAppStore();
  const nodes = useAppStore((s) => s.scene.nodes);

  // UI State
  const [activeCategory, setActiveCategory] = useState<BackdropCategory>('studio');
  const [selectedBackdrop, setSelectedBackdrop] = useState<string | null>(null);
  
  // Options State
  const [scale, setScale] = useState(1.0);
  const [applyEnvironmentMap, setApplyEnvironmentMap] = useState(true);
  const [applyAmbientLight, setApplyAmbientLight] = useState(true);
  const [receiveShadow, setReceiveShadow] = useState(true);
  const [enableLOD, setEnableLOD] = useState(true);

  // Get backdrops for active category
  const backdropItems = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BackdropsPanel.tsx:76',message:'Getting backdrop items',data:{activeCategory,hasBACKDROPS_BY_CATEGORY:!!BACKDROPS_BY_CATEGORY,backdropsByCategoryType:typeof BACKDROPS_BY_CATEGORY,hasCategory:!!BACKDROPS_BY_CATEGORY?.[activeCategory]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (!BACKDROPS_BY_CATEGORY || !BACKDROPS_BY_CATEGORY[activeCategory]) return [];
    return BACKDROPS_BY_CATEGORY[activeCategory] || [];
  }, [activeCategory]);

  // Check if backdrop exists in scene
  const currentBackdrop = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0bda4408-a4ac-499d-af8d-1291b9fac2d6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BackdropsPanel.tsx:80',message:'Finding backdrop',data:{nodesType:typeof nodes,nodesIsArray:Array.isArray(nodes),nodesLength:nodes?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    if (!nodes || !Array.isArray(nodes)) return undefined;
    return nodes.find(node => node.type === 'backdrop');
  }, [nodes]);

  const handleSetBackdrop = () => {
    if (!selectedBackdrop) return;

    const backdrop = ALL_BACKDROPS.find(b => b.id === selectedBackdrop);
    if (!backdrop) return;

    // Remove existing backdrop if any
    if (currentBackdrop) {
      removeNode(currentBackdrop.id);
    }

    // Add backdrop node to scene
    const backdropId = `backdrop-${Date.now()}`;
    addNode({
      id: backdropId,
      type: 'backdrop',
      name: `${backdrop.name} (${backdrop.category})`,
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [scale, scale, scale],
      },
      visible: true,
      userData: {
        backdropId: selectedBackdrop,
        backdropScale: scale,
        applyEnvironmentMap,
        applyAmbientLight,
        receiveShadow,
        enableLOD,
      },
    });

    log.debug('Backdrop set: ', {
      id: backdropId,
      backdrop: backdrop.name,
      environmentMap: applyEnvironmentMap,
      ambientLight: applyAmbientLight,
    });
  };

  const handleRemoveBackdrop = () => {
    if (currentBackdrop) {
      removeNode(currentBackdrop.id);
      log.debug('Backdrop removed');
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Landscape />
        Backdrops Library
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set backdrops and environments with automatic HDR environment maps and ambient lighting.
      </Typography>

      {currentBackdrop && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Current backdrop: <strong>{currentBackdrop.name}</strong>
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
        <Tab value="studio" label="Studio" />
        <Tab value="outdoor" label="Outdoor" />
        <Tab value="indoor" label="Indoor" />
        <Tab value="abstract" label="Abstract" />
        <Tab value="green-screen" label="Green Screen" />
        <Tab value="skybox" label="Skybox" />
        <Tab value="cyclorama" label="Cyclorama" />
      </Tabs>

      {/* Backdrops Grid */}
      <Box sx={{ maxHeight: 300, overflowY: 'auto', mb: 2 }}>
        {backdropItems.length === 0 ? (
          <Alert severity="info">
            No backdrops available in this category yet.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {backdropItems.map((backdrop) => (
              <Grid item xs={12} sm={6} key={backdrop.id}>
                <Card
                  sx={{
                    backgroundColor: selectedBackdrop === backdrop.id ? '#333' : '#2a2a2a', '&:hover': { backgroundColor: '#333' },
                    cursor: 'pointer',
                    border: selectedBackdrop === backdrop.id ? '2px solid #2196f3' : 'none'}}
                  onClick={() => setSelectedBackdrop(backdrop.id)}
                >
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {backdrop.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {backdrop.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={backdrop.style} size="small" />
                      <Chip label={backdrop.lighting} size="small" />
                      <Chip label={backdrop.size} size="small" />
                      {backdrop.hasEnvironmentMap && <Chip label="HDR" size="small" color="success" />}
                      {backdrop.supportsLOD && <Chip label="LOD" size="small" color="success" />}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Options Accordion */}
      <Accordion defaultExpanded sx={{ backgroundColor: '#2a2a2a', mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tune />
            Backdrop Options
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {/* Scale */}
          <Typography variant="caption">Scale: {scale.toFixed(2)}</Typography>
          <Slider
            value={scale}
            onChange={(_, value) => setScale(value as number)}
            min={0.1}
            max={10}
            step={0.1}
            sx={{ mb: 2 }}
          />

          {/* Environment & Lighting Options */}
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WbSunny />
            Environment & Lighting
          </Typography>
          <FormControlLabel
            control={<Switch checked={applyEnvironmentMap} onChange={(e) => setApplyEnvironmentMap(e.target.checked)} />}
            label="Apply Environment Map (HDR)"
          />
          <FormControlLabel
            control={<Switch checked={applyAmbientLight} onChange={(e) => setApplyAmbientLight(e.target.checked)} />}
            label="Apply Ambient Lighting"
          />
          <FormControlLabel
            control={<Switch checked={receiveShadow} onChange={(e) => setReceiveShadow(e.target.checked)} />}
            label="Receive Shadows"
          />
          <FormControlLabel
            control={<Switch checked={enableLOD} onChange={(e) => setEnableLOD(e.target.checked)} />}
            label="Enable LOD"
          />
        </AccordionDetails>
      </Accordion>

      {/* Action Buttons */}
      <Box sx={{ display:'flex', gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<Add />}
          onClick={handleSetBackdrop}
          disabled={!selectedBackdrop}
        >
          Set Backdrop
        </Button>
        {currentBackdrop && (
          <Button
            variant="outlined"
            color="error"
            fullWidth
            startIcon={<Delete />}
            onClick={handleRemoveBackdrop}
          >
            Remove
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default BackdropsPanel;

