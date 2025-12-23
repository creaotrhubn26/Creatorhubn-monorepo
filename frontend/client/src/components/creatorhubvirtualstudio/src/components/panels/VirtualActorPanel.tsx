/**
 * Virtual Actor Panel
 * 
 * Comprehensive UI for generating and customizing 3D human actors for lighting tests.
 * Integrates with Anny parametric body model via Python ML service.
 * 
 * Features:
 * - Body parameters (age, gender, height, weight, muscle)
 * - Appearance customization (skin tone, materials)
 * - Actor presets (portrait, fashion, commercial, fitness, child, elder)
 * - Multiple actors in scene
 * - Save/load configurations
 * 
 * Research-based implementation:
 * - Anny body model: https://arxiv.org/abs/2511.03589
 * - PBR skin shading: https://therealmjp.github.io/posts/sss-intro/
 * - Anthropometric data: CDC, WHO standards
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('VirtualActorPanel, ');
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Grid2 as Grid,
  Slider,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  CircularProgress,
  Alert,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Person,
  Checkroom,
  Business,
  FitnessCenter,
  ChildCare,
  Elderly,
  Add,
  Refresh,
  ExpandMore,
  Palette,
  Accessibility,
  Face,
  RemoveRedEye,
  CheckCircle,
  Error as ErrorIcon,
  DirectionsRun,
} from '@mui/icons-material';
import { useAppStore } from '../../state/store';
import {
  virtualActorService,
  ActorParameters,
  ActorMeshData,
  AnnyModelInfo,
} from '../../core/services/virtualActorService';
import {
  getPresetsByCategory,
  getPresetById,
  SKIN_TONES,
} from '../../core/data/actorPresets';
import {
  getHairStyles,
  getHairStyleById,
} from '../../core/data/hairStyles';
import { GlassesSelector } from '../../ui/components/GlassesSelector';
import { createGlassesModel, GlassesOptions } from '../../core/models/GlassesModel';
import { ActorLibraryPanel } from '../../ui/components/ActorLibraryPanel';

interface VirtualActorPanelProps {
  onActorGenerated?: (actorId: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  portrait: <Person />,
  fashion: <Checkroom />,
  commercial: <Business />,
  fitness: <FitnessCenter />,
  child: <ChildCare />,
  elder: <Elderly />,
};

export const VirtualActorPanel: React.FC<VirtualActorPanelProps> = ({ onActorGenerated }) => {
  const { addNode } = useAppStore();

  // UI State
  const [activeTab, setActiveTab] = useState<'library' | 'presets' | 'custom' | 'appearance' | 'hair' | 'glasses'>('library');
  const [activeCategory, setActiveCategory] = useState<'portrait' | 'fashion' | 'commercial' | 'fitness' | 'child' | 'elder'>('portrait');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Actor Parameters
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState(0.5);
  const [height, setHeight] = useState(0.5);
  const [weight, setWeight] = useState(0.5);
  const [muscle, setMuscle] = useState(0.5);

  // Appearance Parameters
  const [skinTone, setSkinTone] = useState<keyof typeof SKIN_TONES>('medium');
  const [roughness, setRoughness] = useState(0.6);

  // Hair Parameters
  const [selectedHairStyle, setSelectedHairStyle] = useState<string | null>(null);
  const [hairColor, setHairColor] = useState({ hue: 30, saturation: 0.5, lightness: 0.3 }); // Brown
  const [selectedActorForHair, setSelectedActorForHair] = useState<string | null>(null);
  const [hairCategory, setHairCategory] = useState<'all' | 'male' | 'female' | 'children' | 'textured'>('all');

  // Glasses Parameters
  const [glassesEnabled, setGlassesEnabled] = useState(false);
  const [glassesOptions, setGlassesOptions] = useState<Partial<GlassesOptions>>({
    frameStyle: 'rectangular',
    lensType: 'clear',
    frameMaterial: 'plastic',
    frameColor: '#1a1a1a',
  });

  // Actor Management
  const [actorName, setActorName] = useState('Virtual Actor, ');
  const [generatedActors, setGeneratedActors] = useState<string[]>([]);

  // Anny Service Status
  const [annyAvailable, setAnnyAvailable] = useState<boolean | null>(null);
  const [annyModelInfo, setAnnyModelInfo] = useState<AnnyModelInfo | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Pose Parameters (advanced)
  const [posePreset, setPosePreset] = useState<'neutral' | 'a-pose' | 't-pose' | 'relaxed'>('neutral');

  // Check Anny availability on mount
  useEffect(() => {
    const checkAnnyStatus = async () => {
      setHealthLoading(true);
      try {
        const health = await virtualActorService.checkHealth();
        setAnnyAvailable(health.services?.anny === true);
        
        if (health.services?.anny) {
          const info = await virtualActorService.getModelInfo();
          setAnnyModelInfo(info);
        }
      } catch (err) {
        log.warn('Failed to check Anny status: ', err);
        setAnnyAvailable(false);
      } finally {
        setHealthLoading(false);
      }
    };

    checkAnnyStatus();

    // Re-check every 60 seconds
    const interval = setInterval(checkAnnyStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Generate actor from current parameters
   */
  const handleGenerateActor = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: ActorParameters = {
        age,
        gender,
        height,
        weight,
        muscle,
      };

      // Call Python ML service via backend
      const meshData: ActorMeshData = await virtualActorService.generateActor(params);

      // Create Three.js geometry
      const geometry = virtualActorService.createGeometry(meshData);

      // Create skin material (pass hex color string, service will convert to THREE.Color)
      const material = virtualActorService.createSkinMaterial({
        skinTone: SKIN_TONES[skinTone],
        roughness,
      });

      // Add to scene as a 'model' node
      const actorId = `actor-${Date.now()}`;
      addNode({
        id: actorId,
        type: 'model',
        name: actorName || `Actor (${age}y, ${gender === 0 ? 'F' : gender === 1 ? 'M' : 'N'})`,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        visible: true,
        userData: {
          actorType: 'virtual',
          actorParams: params,
          meshData: {
            numVertices: meshData.num_vertices,
            numFaces: meshData.num_faces,
          },
          geometry,  // Store geometry for rendering
          material,  // Store material for rendering
          hasGlasses: glassesEnabled,
          glassesOptions: glassesEnabled ? glassesOptions : null,
        },
      });

      // Add glasses if enabled
      if (glassesEnabled) {
        const glassesModel = createGlassesModel(glassesOptions);
        const glassesId = `glasses-${actorId}`;
        
        addNode({
          id: glassesId,
          type: 'accessory',
          name: `Glasses (${glassesOptions.frameStyle || 'rectangular'})`,
          transform: {
            position: [0, 1.65, 0.1], // Eye level, slightly forward
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          visible: true,
          userData: {
            parentActorId: actorId,
            accessoryType: 'glasses',
            glassesOptions,
            model3d: glassesModel,
          },
        });
      }

      setGeneratedActors(prev => [...prev, actorId]);
      onActorGenerated?.(actorId);

      log.debug('Actor generated: ', {
        id: actorId,
        vertices: meshData.num_vertices,
        faces: meshData.num_faces,
        age: meshData.age,
        model: meshData.model,
      });
    } catch (err) {
      log.error('Error generating actor:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate actor');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apply preset configuration
   */
  const handleApplyPreset = (presetId: string) => {
    const preset = getPresetById(presetId);
    if (!preset) return;

    setAge(preset.parameters.age);
    setGender(preset.parameters.gender);
    setHeight(preset.parameters.height);
    setWeight(preset.parameters.weight);
    setMuscle(preset.parameters.muscle);
    setActorName(preset.name);
  };

  /**
   * Reset to default parameters
   */
  const handleReset = () => {
    setAge(30);
    setGender(0.5);
    setHeight(0.5);
    setWeight(0.5);
    setMuscle(0.5);
    setSkinTone('medium');
    setRoughness(0.6);
    setActorName('Virtual Actor');
  };

  const presets = getPresetsByCategory(activeCategory);

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1e1e1e', color: '#fff' }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Accessibility />
        Virtual Actor Generator
      </Typography>

      {/* Anny Service Status Indicator */}
      <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {healthLoading ? (
              <CircularProgress size={16} />
            ) : annyAvailable ? (
              <CheckCircle sx={{ color: '#4caf50', fontSize: 20 }} />
            ) : (
              <ErrorIcon sx={{ color: '#f44336', fontSize: 20 }} />
            )}
            <Typography variant="body2">
              Anny Body Model: {healthLoading ? 'Checking...' : annyAvailable ? 'Available' : 'Unavailable'}
            </Typography>
          </Box>
          {annyModelInfo?.available && (
            <Tooltip title={`v${annyModelInfo.version} - ${annyModelInfo.license}`}>
              <Chip
                size="small"
                label="Apache 2.0"
                sx={{ 
                  backgroundColor: 'rgba(76, 175, 80, 0.2)', 
                  color: '#4caf50',
                  fontSize: '0.7rem'
                }}
              />
            </Tooltip>
          )}
        </Box>
        {annyModelInfo?.available && (
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              size="small" 
              label={annyModelInfo.features?.age_range || 'All ages'} 
              variant="outlined" 
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
            <Chip 
              size="small" 
              label={`${annyModelInfo.features?.vertices || '13k'} verts`} 
              variant="outlined" 
              sx={{ fontSize: '0.65rem', height: 20 }}
            />
            <Chip 
              size="small" 
              label={annyModelInfo.device === 'cuda' ? 'GPU' : 'CPU'} 
              variant="outlined" 
              sx={{ 
                fontSize: '0.65rem', 
                height: 20,
                borderColor: annyModelInfo.device === 'cuda' ? '#4caf50' : '#ff9800'
              }}
            />
          </Box>
        )}
        {!healthLoading && !annyAvailable && (
          <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
            <Typography variant="caption">
              Python ML service is not running. Start it with: <code>cd python_ml_service && python main.py</code>
            </Typography>
          </Alert>
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Generate realistic 3D human actors for lighting tests and cinematography visualization.
        Powered by Anny (Apache 2.0).
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab value="library" label="Library" icon={<Person />} iconPosition="start" />
        <Tab value="presets" label="Presets" icon={<Person />} iconPosition="start" />
        <Tab value="custom" label="Custom" icon={<Accessibility />} iconPosition="start" />
        <Tab value="appearance" label="Appearance" icon={<Palette />} iconPosition="start" />
        <Tab value="hair" label="Hair" icon={<Face />} iconPosition="start" />
        <Tab value="glasses" label="Glasses" icon={<RemoveRedEye />} iconPosition="start" />
      </Tabs>

      {/* LIBRARY TAB - Pre-generated models for instant use */}
      {activeTab === 'library' && (
        <ActorLibraryPanel />
      )}

      {/* PRESETS TAB */}
      {activeTab === 'presets' && (
        <Box>
          {/* Category Tabs */}
          <Tabs
            value={activeCategory}
            onChange={(_, value) => setActiveCategory(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab value="portrait" label="Portrait" icon={CATEGORY_ICONS.portrait} iconPosition="start" />
            <Tab value="fashion" label="Fashion" icon={CATEGORY_ICONS.fashion} iconPosition="start" />
            <Tab value="commercial" label="Commercial" icon={CATEGORY_ICONS.commercial} iconPosition="start" />
            <Tab value="fitness" label="Fitness" icon={CATEGORY_ICONS.fitness} iconPosition="start" />
            <Tab value="child" label="Child" icon={CATEGORY_ICONS.child} iconPosition="start" />
            <Tab value="elder" label="Elder" icon={CATEGORY_ICONS.elder} iconPosition="start" />
          </Tabs>

          {/* Preset Grid */}
          <Box sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
            <Grid container spacing={2}>
              {presets.map((preset) => (
                <Grid size={{ xs: 12, sm: 6 }} key={preset.id}>
                  <Card
                    sx={{
                      backgroundColor: '#2a2a2a', '&:hover': { backgroundColor: '#333' },
                      cursor: 'pointer'}}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {preset.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {preset.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip label={`${preset.parameters.age}y`} size="small" />
                        <Chip
                          label={preset.parameters.gender === 0 ? 'Female' : preset.parameters.gender === 1 ? 'Male' : 'Neutral'}
                          size="small"
                        />
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button size="small" onClick={() => handleApplyPreset(preset.id)}>
                        Apply
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          handleApplyPreset(preset.id);
                          handleGenerateActor();
                        }}
                        disabled={loading || annyAvailable === false}
                      >
                        Generate
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Box>
      )}

      {/* CUSTOM TAB */}
      {activeTab === 'custom' && (
        <Box>
          <TextField
            fullWidth
            label="Actor Name"
            value={actorName}
            onChange={(e) => setActorName(e.target.value)}
            sx={{ mb: 3 }}
            size="small"
          />

          {/* Body Parameters */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={700}>Body Parameters</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ px: 2 }}>
                {/* Age Slider */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Age: {age} years
                  </Typography>
                  <Tooltip title="Age from 0 (infant) to 100 (elderly)" placement="top">
                    <Slider
                      value={age}
                      onChange={(_, value) => setAge(value as number)}
                      min={0}
                      max={100}
                      step={1}
                      valueLabelDisplay="auto"
                      marks={[
                        { value: 0, label: '0' },
                        { value: 3, label: 'Toddler' },
                        { value: 10, label: 'Child' },
                        { value: 18, label: 'Adult' },
                        { value: 65, label: 'Senior' },
                        { value: 100, label: '100' },
                      ]}
                    />
                  </Tooltip>
                </Box>

                {/* Gender Slider */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Gender: {gender === 0 ? 'Female' : gender === 1 ? 'Male' : `${(gender * 100).toFixed(0)}% Male`}
                  </Typography>
                  <Tooltip title="0=Female, 0.5=Neutral, 1=Male" placement="top">
                    <Slider
                      value={gender}
                      onChange={(_, value) => setGender(value as number)}
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => (value === 0 ? 'F' : value === 1 ? 'M' : 'N')}
                      marks={[
                        { value: 0, label: 'Female' },
                        { value: 0.5, label: 'Neutral' },
                        { value: 1, label: 'Male' },
                      ]}
                    />
                  </Tooltip>
                </Box>

                {/* Height Slider */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Height: {(height * 100).toFixed(0)}% (relative)
                  </Typography>
                  <Tooltip title="Relative height parameter (0=short, 1=tall)" placement="top">
                    <Slider
                      value={height}
                      onChange={(_, value) => setHeight(value as number)}
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                      marks={[
                        { value: 0, label: 'Short' },
                        { value: 0.5, label: 'Average' },
                        { value: 1, label: 'Tall' },
                      ]}
                    />
                  </Tooltip>
                </Box>

                {/* Weight Slider */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Weight: {(weight * 100).toFixed(0)}% (relative)
                  </Typography>
                  <Tooltip title="Relative weight parameter (0=thin, 1=heavy)" placement="top">
                    <Slider
                      value={weight}
                      onChange={(_, value) => setWeight(value as number)}
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                      marks={[
                        { value: 0, label: 'Thin' },
                        { value: 0.5, label: 'Average' },
                        { value: 1, label: 'Heavy' },
                      ]}
                    />
                  </Tooltip>
                </Box>

                {/* Muscle Slider */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Muscle Definition: {(muscle * 100).toFixed(0)}%
                  </Typography>
                  <Tooltip title="Muscle definition (0=low, 1=bodybuilder)" placement="top">
                    <Slider
                      value={muscle}
                      onChange={(_, value) => setMuscle(value as number)}
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                      marks={[
                        { value: 0, label: 'Low' },
                        { value: 0.5, label: 'Moderate' },
                        { value: 1, label: 'High' },
                      ]}
                    />
                  </Tooltip>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Pose Presets */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DirectionsRun sx={{ fontSize: 18 }} />
                <Typography fontWeight={700}>Pose (Advanced)</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ px: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select a pose preset for the generated actor. Custom poses require the body_pose parameter (21 joints x 3 DoF).
                </Typography>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Pose Preset</InputLabel>
                  <Select
                    value={posePreset}
                    label="Pose Preset"
                    onChange={(e) => setPosePreset(e.target.value as typeof posePreset)}
                  >
                    <MenuItem value="neutral">Neutral (Default)</MenuItem>
                    <MenuItem value="a-pose">A-Pose (Arms Down)</MenuItem>
                    <MenuItem value="t-pose">T-Pose (Arms Out)</MenuItem>
                    <MenuItem value="relaxed">Relaxed Standing</MenuItem>
                  </Select>
                </FormControl>

                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    Pose parameters (body_pose) are 63 values representing 21 joint rotations.
                    Currently, only preset poses are supported. Full pose editing coming soon.
                  </Typography>
                </Alert>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Quick Actions */}
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleReset}
              fullWidth
            >
              Reset
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <Add />}
              onClick={handleGenerateActor}
              disabled={loading || annyAvailable === false}
              fullWidth
            >
              {loading ? 'Generating...' : annyAvailable === false ? 'Anny Unavailable' : 'Generate Actor'}
            </Button>
          </Box>
        </Box>
      )}

      {/* APPEARANCE TAB */}
      {activeTab === 'appearance' && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Note:</strong> Anny generates body geometry only. Advanced appearance features (skin
              details, hair, clothing) require additional systems beyond the current implementation.
            </Typography>
          </Alert>

          {/* Skin Tone */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={700}>Skin Material</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ px: 2 }}>
                {/* Skin Tone Selector */}
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Skin Tone</InputLabel>
                  <Select
                    value={skinTone}
                    label="Skin Tone"
                    onChange={(e) => setSkinTone(e.target.value as keyof typeof SKIN_TONES)}
                  >
                    <MenuItem value="fair">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: SKIN_TONES.fair,
                            border: '1px solid #666',
                            borderRadius: 1}}
                        />
                        Fair (Fitzpatrick I-II)
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: SKIN_TONES.medium,
                            border: '1px solid #666',
                            borderRadius: 1}}
                        />
                        Medium (Fitzpatrick III)
                      </Box>
                    </MenuItem>
                    <MenuItem value="olive">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: SKIN_TONES.olive,
                            border: '1px solid #666',
                            borderRadius: 1}}
                        />
                        Olive (Fitzpatrick IV)
                      </Box>
                    </MenuItem>
                    <MenuItem value="brown">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: SKIN_TONES.brown,
                            border: '1px solid #666',
                            borderRadius: 1}}
                        />
                        Brown (Fitzpatrick V)
                      </Box>
                    </MenuItem>
                    <MenuItem value="dark">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: SKIN_TONES.dark,
                            border: '1px solid #666',
                            borderRadius: 1}}
                        />
                        Dark (Fitzpatrick VI)
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                {/* Roughness Slider */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" gutterBottom>
                    Skin Roughness: {(roughness * 100).toFixed(0)}%
                  </Typography>
                  <Tooltip title="Surface roughness (0=glossy, 1=matte)" placement="top">
                    <Slider
                      value={roughness}
                      onChange={(_, value) => setRoughness(value as number)}
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
                      marks={[
                        { value: 0, label: 'Glossy' },
                        { value: 0.6, label: 'Skin' },
                        { value: 1, label: 'Matte' },
                      ]}
                    />
                  </Tooltip>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Feature Status */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={700}>Available Features</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ px: 2 }}>
                <Typography variant="body2" color="success.main" sx={{ mb: 1, fontWeight: 600}}>
                  Implemented Features:
                </Typography>
                <Box component="ul" sx={{ pl: 2, color: 'success.main', mb: 2 }}>
                  <li>Eye color, catchlights, and gaze direction (Eye System)</li>
                  <li>Glasses and eyewear (Glasses Tab)</li>
                  <li>Hair styles - male, female, children, textured (Hair Tab)</li>
                  <li>Clothing and costumes (Clothing Panel)</li>
                  <li>Hand poses and gestures (Body Animations)</li>
                  <li>Pose presets - 30+ professional poses (Pose Library)</li>
                  <li>Skin tone variations - Fitzpatrick I-VI</li>
                  <li>Body type customization (age, height, weight, muscle)</li>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600}}>
                  Planned Features:
                </Typography>
                <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
                  <li>Facial expressions and emotions</li>
                  <li>Facial hair (beard, mustache)</li>
                  <li>Makeup and cosmetics</li>
                  <li>Jewelry accessories</li>
                  <li>Tattoos and body art</li>
                  <li>Skin details (pores, wrinkles, blemishes)</li>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* HAIR TAB */}
      {activeTab === 'hair' && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add hairstyles to your virtual actors. Currently featuring 7 male styles from the Fashion Collection.
          </Typography>

          {/* Actor Selection */}
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Select Actor</InputLabel>
              <Select
                value={selectedActorForHair || ', '}
                onChange={(e) => setSelectedActorForHair(e.target.value)}
                label="Select Actor"
              >
                {generatedActors.length === 0 && (
                  <MenuItem disabled value="">
                    No actors generated yet
                  </MenuItem>
                )}
                {generatedActors.map((actorId) => (
                  <MenuItem key={actorId} value={actorId}>
                    {actorId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Hair Category Filter */}
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['all','male','female','children', 'textured'].map((cat) => (
              <Chip
                key={cat}
                label={cat === 'all' ? 'All (40)' : cat === 'male' ? 'Male (7)' : cat === 'female' ? 'Female (15)' : cat === 'children' ? 'Children (10)' : 'Textured (8)'}
                onClick={() => setHairCategory(cat as any)}
                color={hairCategory === cat ? 'primary' : 'default'}
                variant={hairCategory === cat ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {/* Hair Styles Grid */}
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
            {hairCategory === 'all' ? 'All Hairstyles (40)' : 
             hairCategory === 'male' ? 'Male Hairstyles (7)' : 
             hairCategory === 'female' ? 'Female Hairstyles (15)' : 
             hairCategory === 'children' ? 'Children Hairstyles (10)' : 
             'Textured Hairstyles (8)'}
          </Typography>
          <Box sx={{ maxHeight: 300, overflowY: 'auto', mb: 2 }}>
            <Grid container spacing={2}>
              {getHairStyles(hairCategory === 'all' ? undefined : hairCategory === 'textured' ? { style: 'textured' as any } : hairCategory === 'children' ? { ageRange: 'child' as any } : { gender: hairCategory as any }).map((hairStyle) => (
                <Grid size={{ xs: 12, sm: 6 }} key={hairStyle.id}>
                  <Card
                    sx={{
                      backgroundColor: selectedHairStyle === hairStyle.id ? '#3a3a3a' : '#2a2a2a', '&:hover': { backgroundColor: '#333' },
                      cursor: 'pointer',
                      border: selectedHairStyle === hairStyle.id ? '2px solid #60a5fa' : 'none'}}
                    onClick={() => setSelectedHairStyle(hairStyle.id)}
                  >
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {hairStyle.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {hairStyle.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip label={hairStyle.length} size="small" />
                        <Chip label={hairStyle.style} size="small" />
                        {hairStyle.tags?.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Hair Color Customization */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography fontWeight={700}>Hair Color</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ px: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Hue: {hairColor.hue}°
                  </Typography>
                  <Slider
                    value={hairColor.hue}
                    onChange={(_, value) => setHairColor({ ...hairColor, hue: value as number })}
                    min={0}
                    max={360}
                    step={1}
                    marks={[
                      { value: 0, label: 'Red' },
                      { value: 30, label: 'Brown' },
                      { value: 60, label: 'Blonde' },
                      { value: 180, label: 'Blue' },
                    ]}
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Saturation: {(hairColor.saturation * 100).toFixed(0)}%
                  </Typography>
                  <Slider
                    value={hairColor.saturation}
                    onChange={(_, value) => setHairColor({ ...hairColor, saturation: value as number })}
                    min={0}
                    max={1}
                    step={0.01}
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Lightness: {(hairColor.lightness * 100).toFixed(0)}%
                  </Typography>
                  <Slider
                    value={hairColor.lightness}
                    onChange={(_, value) => setHairColor({ ...hairColor, lightness: value as number })}
                    min={0}
                    max={1}
                    step={0.01}
                  />
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Add Hair Button */}
          <Button
            variant="contained"
            fullWidth
            startIcon={<Add />}
            onClick={() => {
              if (!selectedActorForHair || !selectedHairStyle) {
                setError('Please select an actor and a hairstyle');
                return;
              }

              // Add hair node to scene
              const hairId = `hair-${Date.now()}`;
              addNode({
                id: hairId,
                type: 'hair',
                name: `Hair (${getHairStyleById(selectedHairStyle)?.name})`,
                transform: {
                  position: [0, 0, 0],
                  rotation: [0, 0, 0],
                  scale: [1, 1, 1],
                },
                visible: true,
                userData: {
                  parentActorId: selectedActorForHair,
                  hairStyleId: selectedHairStyle,
                  hairColor: {
                    hue: hairColor.hue,
                    saturation: hairColor.saturation,
                    lightness: hairColor.lightness,
                  },
                  hairScale: 1.0,
                  hairOffset: { x: 0, y: 1.6, z: 0 },
                },
              });

              log.debug('Hair added:', {
                hairId,
                actorId: selectedActorForHair,
                styleId: selectedHairStyle,
                color: hairColor,
              });
            }}
            sx={{ mt: 2 }}
            disabled={!selectedActorForHair || !selectedHairStyle}
          >
            Add Hair to Actor
          </Button>

          {/* Info */}
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>40 Hair Styles Available:</strong> 7 male, 15 female, 10 children, and 8 textured styles.
              Use the gender filter above to browse all categories.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* GLASSES TAB */}
      {activeTab === 'glasses' && (
        <Box>
          <GlassesSelector
            enabled={glassesEnabled}
            onEnabledChange={setGlassesEnabled}
            options={glassesOptions}
            onOptionsChange={setGlassesOptions}
            selectedActorId={generatedActors.length > 0 ? generatedActors[generatedActors.length - 1] : undefined}
            onApplyToActor={(actorId, options) => {
              // Create glasses model and add to scene
              const glassesModel = createGlassesModel(options);
              const glassesId = `glasses-${Date.now()}`;
              
              addNode({
                id: glassesId,
                type: 'accessory',
                name: `Glasses (${options.frameStyle || 'rectangular'})`,
                transform: {
                  position: [0, 1.65, 0.1], // Eye level, slightly forward
                  rotation: [0, 0, 0],
                  scale: [1, 1, 1],
                },
                visible: true,
                userData: {
                  parentActorId: actorId,
                  accessoryType: 'glasses',
                  glassesOptions: options,
                  model3d: glassesModel,
                },
              });
              
              log.debug('Glasses added to actor:', { glassesId, actorId, options });
            }}
          />
        </Box>
      )}

      {/* Generated Actors Summary */}
      {generatedActors.length > 0 && (
        <Box sx={{ mt: 2, p: 2, backgroundColor:'#2a2a2a', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Generated Actors: {generatedActors.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Actors have been added to the scene. Use the Scene Layers panel to manage them.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default VirtualActorPanel;

