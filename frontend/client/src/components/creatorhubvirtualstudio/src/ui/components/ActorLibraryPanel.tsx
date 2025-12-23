/**
 * Actor Library Panel
 * 
 * Displays pre-generated 3D human models ready for instant use.
 * Supports batch generation and categorized browsing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Grid2 as Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
} from '@mui/material';
import {
  Refresh,
  Delete,
  Person,
  Checkroom,
  Business,
  FitnessCenter,
  ChildCare,
  Elderly,
  CloudDownload,
  CheckCircle,
  ErrorOutline,
  Storage,
  TheaterComedy,
  Add,
} from '@mui/icons-material';
import { useAppStore } from '../../state/store';
import { virtualActorService } from '../../core/services/virtualActorService';
import {
  actorModelCache,
  CachedActor,
  GenerationProgress,
} from '../../core/services/actorModelCache';
import type { ActorPreset } from '../../core/services/virtualActorService';
import { AnimatedActorCard } from './AnimatedActorCard';
import { HDRIRecommendationDialog } from './HDRIRecommendationDialog';
import { LightSetupRecommendationDialog } from './LightSetupRecommendationDialog';
import { PBRRecommendationDialog } from './PBRRecommendationDialog';
import { HDRIRecommendation } from '../../core/services/hdriRecommendationService';
import { LightSetupRecommendation } from '../../core/services/lightSetupRecommendationService';
import { PBRItem } from '../../core/services/pbrRecommendationService';
import { getEntranceAnimation, playEntranceAnimation } from '../../core/animations/CharacterAnimations';
import { SKIN_TONES } from '../../core/data/actorPresets';
import { logger } from '../../core/services/logger';

const log = logger.module('ActorLibraryPanel');

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  portrait: <Person />,
  fashion: <Checkroom />,
  commercial: <Business />,
  fitness: <FitnessCenter />,
  child: <ChildCare />,
  elder: <Elderly />'film-character': <TheaterComedy />,
};

export const ActorLibraryPanel: React.FC = () => {
  const { addNode } = useAppStore();

  // State
  const [cachedActors, setCachedActors] = useState<CachedActor[]>([]);
  const [allPresets, setAllPresets] = useState<ActorPreset[]>([]);
  const [presetCounts, setPresetCounts] = useState<{ total: number; categories: Record<string, number> }>({ total: 0, categories: {} });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeGenre, setActiveGenre] = useState<string>('all');
  const [confirmDialog, setConfirmDialog] = useState<'clear' | 'generate' | null>(null);
  const [annyAvailable, setAnnyAvailable] = useState(false);
  
  // HDRI Recommendation Dialog state
  const [hdriDialogOpen, setHdriDialogOpen] = useState(false);
  const [pendingActor, setPendingActor] = useState<CachedActor | null>(null);
  
  // Light Setup Recommendation Dialog state
  const [lightDialogOpen, setLightDialogOpen] = useState(false);
  const [selectedHDRI, setSelectedHDRI] = useState<HDRIRecommendation | null>(null);
  
  // PBR Recommendation Dialog state
  const [pbrDialogOpen, setPbrDialogOpen] = useState(false);
  const [selectedLighting, setSelectedLighting] = useState<LightSetupRecommendation | null>(null);

  // Load cached actors and presets on mount
  useEffect(() => {
    loadCachedActors();
    loadPresets();
    checkAnnyStatus();
  }, []);

  const loadPresets = async () => {
    try {
      const [presets, counts] = await Promise.all([
        actorModelCache.getAllPresets(),
        actorModelCache.getPresetCategories(),
      ]);
      setAllPresets(presets);
      setPresetCounts(counts);
      log.info('Loaded presets from database: ', counts.total);
    } catch (err) {
      log.error('Failed to load presets: ', err);
    }
  };

  const checkAnnyStatus = async () => {
    const available = await virtualActorService.isAnnyAvailable();
    setAnnyAvailable(available);
  };

  const loadCachedActors = async () => {
    setLoading(true);
    try {
      const actors = await actorModelCache.getAllCached();
      setCachedActors(actors);
    } catch (err) {
      log.error('Failed to load cached actors: ', err);
      setError('Failed to load model library');
    } finally {
      setLoading(false);
    }
  };

  // Filter actors by category and genre
  const filteredActors = cachedActors.filter(actor => {
    // Category filter
    if (activeCategory !== 'all' && actor.category !== activeCategory) {
      return false;
    }
    // Genre filter (only for film-character category)
    if (activeCategory === 'film-character' && activeGenre !== 'all') {
      return actor.metadata?.genre === activeGenre;
    }
    return true;
  });

  // Get category counts
  const categoryCounts = cachedActors.reduce((acc, actor) => {
    acc[actor.category] = (acc[actor.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get genre counts for film characters
  const genreCounts = cachedActors
    .filter(a => a.category === 'film-character' && a.metadata?.genre)
    .reduce((acc, actor) => {
      const genre = actor.metadata?.genre || 'other';
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  // Available genres
  const availableGenres = Object.keys(genreCounts).sort();

  // Handle clicking "Add to Scene" - show HDRI recommendation dialog first
  const handleAddToScene = useCallback((actor: CachedActor) => {
    setPendingActor(actor);
    setHdriDialogOpen(true);
  }, []);

  // Actually add the actor to the scene (called after HDRI dialog)
  const addActorToScene = useCallback(async (actor: CachedActor) => {
    try {
      // Create geometry from cached mesh data
      const geometry = virtualActorService.createGeometry(actor.meshData);
      
      // Create skin material with transparency for fade animations
      const material = virtualActorService.createSkinMaterial({
        skinTone: SKIN_TONES[actor.skinTone],
        roughness: 0.6,
      });
      material.transparent = true;
      material.opacity = 1;

      // Get entrance animation for this character's genre
      const entranceAnimation = getEntranceAnimation(actor.metadata?.genre);

      // Add to scene with entrance animation metadata
      const nodeId = `actor-${Date.now()}`;
      addNode({
        id: nodeId,
        type: 'model',
        name: actor.name,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
        userData: {
          actorType: 'virtual',
          actorParams: actor.parameters,
          meshData: {
            numVertices: actor.meshData.num_vertices,
            numFaces: actor.meshData.num_faces,
          },
          geometry,
          material,
          cachedActorId: actor.id,
          skinTone: actor.skinTone,
          // Extended character properties
          appearance: actor.appearance,
          costume: actor.costume,
          characterMetadata: actor.metadata,
          // Entrance animation info
          entranceAnimation: {
            name: entranceAnimation.name,
            duration: entranceAnimation.duration,
            genre: actor.metadata?.genre || 'default',
            playOnAdd: true,
          },
        },
      });

      // Dispatch event to trigger entrance animation in 3D viewport
      window.dispatchEvent(new CustomEvent('vs-actor-entrance', {
        detail: {
          nodeId,
          genre: actor.metadata?.genre || 'default',
          animationName: entranceAnimation.name,
          duration: entranceAnimation.duration,
        }
      }));

      log.info('Added cached actor to scene with entrance animation:', {
        name: actor.name,
        animation: entranceAnimation.name,
        duration: entranceAnimation.duration,
      });
    } catch (err) {
      log.error('Failed to add actor to scene:', err);
      setError('Failed to add actor to scene');
    }
  }, [addNode]);

  // ============================================================================
  // DIALOG FLOW: HDRI → PBR/Props → Light Setup → Add Actor
  // This order matches professional photography workflow:
  // 1. Choose environment (HDRI)
  // 2. Dress the set (Props)
  // 3. Light the scene (considering all surfaces)
  // 4. Bring in talent (Actor)
  // ============================================================================

  // Step 1: Handle HDRI selection from recommendation dialog
  const handleHDRISelect = useCallback((hdri: HDRIRecommendation) => {
    // Dispatch event to load the selected HDRI
    window.dispatchEvent(new CustomEvent('vs-load-hdri', {
      detail: {
        id: hdri.id,
        url: hdri.url,
        intensity: hdri.intensity,
        name: hdri.name,
      }
    }));
    
    log.info('Step 1/3: Applied recommended HDRI:', hdri.name);
    
    // Store selected HDRI and open PBR dialog (Step 2)
    setSelectedHDRI(hdri);
    setHdriDialogOpen(false);
    setPbrDialogOpen(true); // Changed: PBR before Lights
  }, []);

  // Step 1 Skip: Handle skipping HDRI recommendation
  const handleHDRISkip = useCallback(() => {
    log.info('Step 1/3: Skipped HDRI recommendation');
    // Skip HDRI but still show PBR dialog
    setSelectedHDRI(null);
    setHdriDialogOpen(false);
    setPbrDialogOpen(true); // Changed: PBR before Lights
  }, []);

  // Step 2: Handle PBR selection from recommendation dialog
  const handlePBRSelect = useCallback((items: PBRItem[]) => {
    // Dispatch event to add each selected PBR item
    items.forEach(item => {
      window.dispatchEvent(new CustomEvent('vs-add-pbr-item', {
        detail: {
          id: item.id,
          name: item.name,
          type: item.type,
          category: item.category,
          material: item.material,
          position: item.position,
          rotation: item.rotation,
          scale: item.scale,
        }
      }));
    });
    
    log.info('Step 2/3: Added PBR items:', items.map(i => i.name).join(','));
    
    // Now open light setup dialog (Step 3)
    setPbrDialogOpen(false);
    setLightDialogOpen(true); // Changed: Lights after Props
  }, []);

  // Step 2 Skip: Handle skipping PBR recommendation
  const handlePBRSkip = useCallback(() => {
    log.info('Step 2/3: Skipped PBR recommendation');
    // Skip PBR but still show light setup dialog
    setPbrDialogOpen(false);
    setLightDialogOpen(true); // Changed: Lights after Props
  }, []);

  // Step 3: Handle light setup selection from recommendation dialog
  const handleLightSetupSelect = useCallback((setup: LightSetupRecommendation) => {
    // Dispatch event to apply the selected light setup
    window.dispatchEvent(new CustomEvent('vs-apply-light-setup', {
      detail: {
        id: setup.id,
        name: setup.name,
        lights: setup.lights,
        keyToFillRatio: setup.keyToFillRatio,
      }
    }));
    
    log.info('Step 3/3: Applied recommended light setup:', setup.name);
    
    // Now add the actor to scene (Final Step)
    setSelectedLighting(setup);
    setLightDialogOpen(false);
    
    if (pendingActor) {
      addActorToScene(pendingActor);
      setPendingActor(null);
      setSelectedHDRI(null);
      setSelectedLighting(null);
    }
  }, [pendingActor, addActorToScene]);

  // Step 3 Skip: Handle skipping light setup recommendation
  const handleLightSetupSkip = useCallback(() => {
    log.info('Step 3/3: Skipped light setup recommendation');
    // Add actor without custom lighting
    setSelectedLighting(null);
    setLightDialogOpen(false);
    
    if (pendingActor) {
      addActorToScene(pendingActor);
      setPendingActor(null);
      setSelectedHDRI(null);
      setSelectedLighting(null);
    }
  }, [pendingActor, addActorToScene]);

  // Handle batch generation
  const handleGenerateLibrary = async (full: boolean) => {
    setConfirmDialog(null);
    setGenerating(true);
    setProgress(null);
    setError(null);

    try {
      const result = full
        ? await actorModelCache.generateFullLibrary(setProgress)
        : await actorModelCache.generateDefaultLibrary(setProgress);

      if (result.errors.length > 0) {
        setError(`Generated ${result.completed}/${result.total} models. ${result.errors.length} errors.`);
      }

      await loadCachedActors();
    } catch (err) {
      log.error('Batch generation failed:', err);
      setError('Failed to generate model library');
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  // Handle clear cache
  const handleClearCache = async () => {
    setConfirmDialog(null);
    try {
      await actorModelCache.clearAll();
      setCachedActors([]);
      log.info('Actor cache cleared');
    } catch (err) {
      log.error('Failed to clear cache:', err);
      setError('Failed to clear model library');
    }
  };

  // Handle delete single actor
  const handleDeleteActor = async (id: string) => {
    try {
      await actorModelCache.deleteActor(id);
      setCachedActors(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      log.error('Failed to delete actor:', err);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Storage />
          Model Library
          <Chip 
            size="small" 
            label={`${cachedActors.length} models`} 
            sx={{ ml: 1 }}
          />
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadCachedActors} size="small" disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear All">
            <IconButton 
              onClick={() => setConfirmDialog('clear')} 
              size="small"
              disabled={cachedActors.length === 0}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Anny Status */}
      <Alert 
        severity={annyAvailable ? 'success' : 'warning'} 
        sx={{ mb: 2 }}
        icon={annyAvailable ? <CheckCircle /> : <ErrorOutline />}
      >
        {annyAvailable 
          ? 'Anny ML service is running. Ready to generate models.'
          : 'Anny ML service is not available. Start it to generate new models.'}
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Generation Progress */}
      {generating && progress && (
        <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Generating: {progress.current} ({progress.completed}/{progress.total})
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={(progress.completed / progress.total) * 100} 
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            This may take a few minutes. Do not close this panel.
          </Typography>
        </Box>
      )}

      {/* Generate Buttons */}
      {cachedActors.length === 0 && !generating && (
        <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            No pre-generated models yet. Generate a library to use actors instantly.
            {presetCounts.total > 0 && ` (${presetCounts.total} presets available in database)`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<CloudDownload />}
              onClick={() => handleGenerateLibrary(false)}
              disabled={!annyAvailable || generating}
            >
              Generate Essential (20 models)
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudDownload />}
              onClick={() => setConfirmDialog('generate')}
              disabled={!annyAvailable || generating}
            >
              Generate Full Library ({presetCounts.total || 84} models)
            </Button>
          </Box>
        </Box>
      )}

      {/* Add More Button */}
      {cachedActors.length > 0 && cachedActors.length < presetCounts.total && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={() => setConfirmDialog('generate')}
          disabled={!annyAvailable || generating}
          sx={{ mb: 2 }}
        >
          Generate More Models ({presetCounts.total - cachedActors.length} remaining)
        </Button>
      )}

      {/* Category Tabs */}
      {cachedActors.length > 0 && (
        <>
          <Tabs
            value={activeCategory}
            onChange={(_, value) => {
              setActiveCategory(value);
              setActiveGenre('all'); // Reset genre filter when changing category
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab 
              value="all" 
              label={
                <Badge badgeContent={cachedActors.length} color="primary">
                  <Typography variant="body2" sx={{ pr: 2 }}>All</Typography>
                </Badge>
              }
            />
            {Object.entries(CATEGORY_ICONS).map(([category, icon]) => (
              <Tab
                key={category}
                value={category}
                icon={icon}
                iconPosition="start"
                label={
                  <Badge badgeContent={categoryCounts[category] || 0} color="primary">
                    <Typography variant="body2" sx={{ pr: 2, textTransform: 'capitalize' }}>
                      {category}
                    </Typography>
                  </Badge>
                }
                disabled={!categoryCounts[category]}
              />
            ))}
          </Tabs>

          {/* Genre Filter for Film Characters */}
          {activeCategory === 'film-character' && availableGenres.length > 0 && (
            <Box sx={{ mb: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                Genre:
              </Typography>
              <Chip
                label={`All (${categoryCounts['film-character'] || 0})`}
                size="small"
                onClick={() => setActiveGenre('all')}
                color={activeGenre === 'all' ? 'primary' : 'default'}
                variant={activeGenre === 'all' ? 'filled' : 'outlined'}
              />
              {availableGenres.map(genre => (
                <Chip
                  key={genre}
                  label={`${genre.replace(/-/g, ', ')} (${genreCounts[genre] || 0})`}
                  size="small"
                  onClick={() => setActiveGenre(genre)}
                  color={activeGenre === genre ? 'secondary' : 'default'}
                  variant={activeGenre === genre ? 'filled' : 'outlined'}
                  sx={{ textTransform: 'capitalize' }}
                />
              ))}
            </Box>
          )}

          {/* Model Grid */}
          <Box sx={{ maxHeight: 450, overflowY: 'auto' }}>
            {loading ? (
              <LinearProgress />
            ) : filteredActors.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                No models in this category
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {filteredActors.map((actor) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={actor.id}>
                    <AnimatedActorCard
                      actor={actor}
                      onAddToScene={handleAddToScene}
                      onDelete={handleDeleteActor}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </>
      )}

      {/* Stats Footer */}
      {cachedActors.length > 0 && (
        <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {cachedActors.length} models cached | 
            Avg {(cachedActors.reduce((sum, a) => sum + a.meshData.num_vertices, 0) / cachedActors.length / 1000).toFixed(1)}k vertices |
            Ready for instant use
          </Typography>
        </Box>
      )}

      {/* Confirm Dialogs */}
      <Dialog open={confirmDialog === 'clear'} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>Clear Model Library?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove all {cachedActors.length} pre-generated models from your library.
            You can regenerate them later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Cancel</Button>
          <Button onClick={handleClearCache} color="error">Clear All</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDialog === 'generate'} onClose={() => setConfirmDialog(null)}>
        <DialogTitle>Generate Full Model Library?</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            This will generate {presetCounts.total || 84} diverse human models from the database including:
          </Typography>
          <Box component="ul" sx={{ pl: 2, fontSize:'0.875rem' }}>
            <li>Portrait models ({presetCounts.categories.portrait || 19} presets - young, mature, diverse body types)</li>
            <li>Fashion models ({presetCounts.categories.fashion || 12} presets - runway, catalog, streetwear)</li>
            <li>Commercial/business ({presetCounts.categories.commercial || 12} presets - executives, professionals)</li>
            <li>Fitness/sports ({presetCounts.categories.fitness || 16} presets - athletes, dancers, bodybuilders)</li>
            <li>Children ({presetCounts.categories.child || 12} presets - infant to teen)</li>
            <li>Elderly ({presetCounts.categories.elder || 13} presets - 60s to 80s)</li>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="caption">
              Each model generation takes ~2-3 seconds. Total time: ~3-4 minutes for {presetCounts.total || 84} models.
              Models will be cached in database for instant future access.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Cancel</Button>
          <Button onClick={() => handleGenerateLibrary(true)} variant="contained">
            Generate {presetCounts.total || 84} Models
          </Button>
        </DialogActions>
      </Dialog>

      {/* HDRI Recommendation Dialog (Step 1: First) */}
      <HDRIRecommendationDialog
        open={hdriDialogOpen}
        onClose={() => {
          setHdriDialogOpen(false);
          setPendingActor(null);
        }}
        actor={pendingActor}
        onSelectHDRI={handleHDRISelect}
        onSkip={handleHDRISkip}
      />

      {/* Light Setup Recommendation Dialog (Step 3: After Props, Final Step) */}
      <LightSetupRecommendationDialog
        open={lightDialogOpen}
        onClose={() => {
          setLightDialogOpen(false);
          setPendingActor(null);
          setSelectedHDRI(null);
          setSelectedLighting(null);
        }}
        actor={pendingActor}
        hdri={selectedHDRI}
        onSelectSetup={handleLightSetupSelect}
        onSkip={handleLightSetupSkip}
      />

      {/* PBR Recommendation Dialog (Step 2: After HDRI, Before Lights) */}
      <PBRRecommendationDialog
        open={pbrDialogOpen}
        onClose={() => {
          setPbrDialogOpen(false);
          setPendingActor(null);
          setSelectedHDRI(null);
        }}
        actor={pendingActor}
        hdri={selectedHDRI}
        onSelectItems={handlePBRSelect}
        onSkip={handlePBRSkip}
      />
    </Paper>
  );
};

export default ActorLibraryPanel;

