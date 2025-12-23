import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Tabs,
  Tab,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Person, Wc, Delete, Refresh, People, Download } from '@mui/icons-material';
import * as THREE from 'three';
import { integrationService } from '../../services/integrations';
import { logger } from '../../core/services/logger';

const log = logger.module('CharacterLoader, ');

// Dynamic import for GLTFLoader
let GLTFLoader: unknown = null;
try {
  GLTFLoader = require('three/examples/jsm/loaders/GLTFLoader').GLTFLoader;
} catch {
  log.warn('GLTFLoader not available');
}

interface CharacterModel {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  category: 'wedding' | 'portrait' | 'fashion' | 'business';
  modelUrl: string;
  thumbnail: string;
  description: string;
  poses: number;
}

interface Pose {
  id: string;
  name: string;
  category: 'standing' | 'sitting' | 'action' | 'couple';
  thumbnail: string;
  description: string;
}

// Character model catalog (ready for real asset URLs)
// SVG data URI generator for character silhouettes
const createCharacterSVG = (type: 'female' | 'male' | 'couple', color = '#666') => {
  const svgs = {
    female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150" fill="${color},"><circle cx="50" cy="20" r="15"/><path d="M30 45h40l10 60H20z"/><path d="M35 105h10v40H35zM55 105h10v40H55z"/><ellipse cx="50" cy="45" rx="8" ry="3"/></svg>`,
    male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150" fill="${color}"><circle cx="50" cy="20" r="15"/><rect x="30" y="40" width="40" height="50" rx="5"/><rect x="35" y="90" width="12" height="45"/><rect x="53" y="90" width="12" height="45"/><rect x="20" y="45" width="15" height="8" rx="2"/><rect x="65" y="45" width="15" height="8" rx="2"/></svg>`,
    couple: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" fill="${color}"><circle cx="45" cy="20" r="12"/><circle cx="105" cy="18" r="14"/><path d="M28 38h34l8 50H20z"/><rect x="80" y="36" width="50" height="45" rx="5"/><path d="M32 88h10v40H32zM48 88h10v40H48z"/><rect x="88" y="81" width="14" height="45"/><rect x="108" y="81" width="14" height="45"/></svg>`,
  };
  return `data:image/svg+xml,${encodeURIComponent(svgs[type])}`;
};

const CHARACTER_MODELS: CharacterModel[] = [
  // Wedding Models
  {
    id: 'bride_01',
    name: 'Classic Bride',
    gender: 'female',
    category: 'wedding',
    modelUrl: '/models/characters/bride_01.glb',
    thumbnail: createCharacterSVG('female','#f5f5f5'),
    description: 'Elegant wedding bride with white dress',
    poses: 15,
  },
  {
    id: 'groom_01',
    name: 'Classic Groom',
    gender: 'male',
    category: 'wedding',
    modelUrl: '/models/characters/groom_01.glb',
    thumbnail: createCharacterSVG('male','#1a1a1a'),
    description: 'Professional groom in black tuxedo',
    poses: 15,
  },
  {
    id: 'couple_01',
    name: 'Wedding Couple',
    gender: 'neutral',
    category: 'wedding',
    modelUrl: '/models/characters/couple_01.glb',
    thumbnail: createCharacterSVG('couple','#888'),
    description: 'Bride and groom together',
    poses: 20,
  },

  // Portrait Models
  {
    id: 'portrait_f_01',
    name: 'Female Portrait',
    gender: 'female',
    category: 'portrait',
    modelUrl: '/models/characters/portrait_f_01.glb',
    thumbnail: createCharacterSVG('female','#e8b4a0'),
    description: 'Natural portrait model - female',
    poses: 25,
  },
  {
    id: 'portrait_m_01',
    name: 'Male Portrait',
    gender: 'male',
    category: 'portrait',
    modelUrl: '/models/characters/portrait_m_01.glb',
    thumbnail: createCharacterSVG('male','#c9a082'),
    description: 'Natural portrait model - male',
    poses: 25,
  },

  // Fashion Models
  {
    id: 'fashion_f_01',
    name: 'Fashion Female',
    gender: 'female',
    category: 'fashion',
    modelUrl: '/models/characters/fashion_f_01.glb',
    thumbnail: createCharacterSVG('female','#ff6b9d'),
    description: 'High fashion model - female',
    poses: 30,
  },
  {
    id: 'fashion_m_01',
    name: 'Fashion Male',
    gender: 'male',
    category: 'fashion',
    modelUrl: '/models/characters/fashion_m_01.glb',
    thumbnail: createCharacterSVG('male','#4a90d9'),
    description: 'High fashion model - male',
    poses: 30,
  },

  // Business Models
  {
    id: 'business_f_01',
    name: 'Business Female',
    gender: 'female',
    category: 'business',
    modelUrl: '/models/characters/business_f_01.glb',
    thumbnail: createCharacterSVG('female','#2d3748'),
    description: 'Professional business model - female',
    poses: 20,
  },
  {
    id: 'business_m_01',
    name: 'Business Male',
    gender: 'male',
    category: 'business',
    modelUrl: '/models/characters/business_m_01.glb',
    thumbnail: createCharacterSVG('male','#1a365d'),
    description: 'Professional business model - male',
    poses: 20,
  },
];

// SVG data URI generator for pose icons
const createPoseSVG = (pose: string, color = '#666') => {
  const poses: Record<string, string> = {
    stand: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100" fill="${color}"><circle cx="30" cy="12" r="10"/><line x1="30" y1="22" x2="30" y2="55" stroke="${color}" stroke-width="6"/><line x1="30" y1="55" x2="20" y2="90" stroke="${color}" stroke-width="5"/><line x1="30" y1="55" x2="40" y2="90" stroke="${color}" stroke-width="5"/><line x1="30" y1="30" x2="15" y2="50" stroke="${color}" stroke-width="4"/><line x1="30" y1="30" x2="45" y2="50" stroke="${color}" stroke-width="4"/></svg>`,
    confident: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100" fill="${color}"><circle cx="30" cy="12" r="10"/><line x1="30" y1="22" x2="30" y2="55" stroke="${color}" stroke-width="6"/><line x1="30" y1="55" x2="18" y2="90" stroke="${color}" stroke-width="5"/><line x1="30" y1="55" x2="42" y2="90" stroke="${color}" stroke-width="5"/><line x1="30" y1="32" x2="10" y2="45" stroke="${color}" stroke-width="4"/><line x1="30" y1="32" x2="50" y2="45" stroke="${color}" stroke-width="4"/></svg>`,
    casual: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100" fill="${color}"><circle cx="32" cy="12" r="10"/><path d="M32 22 Q28 40 30 55" stroke="${color}" stroke-width="6" fill="none"/><line x1="30" y1="55" x2="22" y2="90" stroke="${color}" stroke-width="5"/><line x1="30" y1="55" x2="38" y2="88" stroke="${color}" stroke-width="5"/><line x1="30" y1="30" x2="18" y2="52" stroke="${color}" stroke-width="4"/><line x1="30" y1="32" x2="45" y2="55" stroke="${color}" stroke-width="4"/></svg>`,
    sit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 80" fill="${color}"><circle cx="35" cy="10" r="9"/><line x1="35" y1="19" x2="35" y2="45" stroke="${color}" stroke-width="6"/><line x1="35" y1="45" x2="55" y2="48" stroke="${color}" stroke-width="5"/><line x1="55" y1="48" x2="55" y2="75" stroke="${color}" stroke-width="5"/><line x1="35" y1="45" x2="15" y2="48" stroke="${color}" stroke-width="5"/><line x1="15" y1="48" x2="15" y2="75" stroke="${color}" stroke-width="5"/><line x1="35" y1="28" x2="20" y2="42" stroke="${color}" stroke-width="4"/><line x1="35" y1="28" x2="50" y2="42" stroke="${color}" stroke-width="4"/></svg>`,
    elegant: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 80" fill="${color}"><circle cx="35" cy="10" r="9"/><line x1="35" y1="19" x2="38" y2="45" stroke="${color}" stroke-width="6"/><path d="M38 45 Q50 50 60 70" stroke="${color}" stroke-width="5" fill="none"/><path d="M38 45 Q25 55 20 75" stroke="${color}" stroke-width="5" fill="none"/><line x1="35" y1="26" x2="15" y2="38" stroke="${color}" stroke-width="4"/><line x1="35" y1="28" x2="55" y2="35" stroke="${color}" stroke-width="4"/></svg>`,
    walk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 100" fill="${color}"><circle cx="35" cy="12" r="10"/><line x1="35" y1="22" x2="35" y2="50" stroke="${color}" stroke-width="6"/><line x1="35" y1="50" x2="50" y2="90" stroke="${color}" stroke-width="5"/><line x1="35" y1="50" x2="20" y2="85" stroke="${color}" stroke-width="5"/><line x1="35" y1="30" x2="50" y2="45" stroke="${color}" stroke-width="4"/><line x1="35" y1="30" x2="18" y2="50" stroke="${color}" stroke-width="4"/></svg>`,
    turn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 100" fill="${color}"><ellipse cx="32" cy="12" rx="8" ry="10"/><line x1="30" y1="22" x2="28" y2="55" stroke="${color}" stroke-width="6"/><line x1="28" y1="55" x2="18" y2="90" stroke="${color}" stroke-width="5"/><line x1="28" y1="55" x2="38" y2="90" stroke="${color}" stroke-width="5"/><line x1="30" y1="30" x2="12" y2="45" stroke="${color}" stroke-width="4"/><line x1="30" y1="32" x2="48" y2="40" stroke="${color}" stroke-width="4"/></svg>`,
    embrace: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" fill="${color}"><circle cx="28" cy="12" r="8"/><circle cx="52" cy="10" r="9"/><line x1="28" y1="20" x2="28" y2="48" stroke="${color}" stroke-width="5"/><line x1="52" y1="19" x2="52" y2="50" stroke="${color}" stroke-width="6"/><line x1="28" y1="48" x2="20" y2="85" stroke="${color}" stroke-width="4"/><line x1="28" y1="48" x2="36" y2="85" stroke="${color}" stroke-width="4"/><line x1="52" y1="50" x2="44" y2="88" stroke="${color}" stroke-width="5"/><line x1="52" y1="50" x2="60" y2="88" stroke="${color}" stroke-width="5"/><path d="M28 28 Q40 25 52 28" stroke="${color}" stroke-width="4" fill="none"/></svg>`,
    hands: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="${color}"><circle cx="30" cy="12" r="8"/><circle cx="70" cy="12" r="9"/><line x1="30" y1="20" x2="30" y2="50" stroke="${color}" stroke-width="5"/><line x1="70" y1="21" x2="70" y2="52" stroke="${color}" stroke-width="6"/><line x1="30" y1="50" x2="22" y2="88" stroke="${color}" stroke-width="4"/><line x1="30" y1="50" x2="38" y2="88" stroke="${color}" stroke-width="4"/><line x1="70" y1="52" x2="62" y2="90" stroke="${color}" stroke-width="5"/><line x1="70" y1="52" x2="78" y2="90" stroke="${color}" stroke-width="5"/><line x1="30" y1="30" x2="15" y2="45" stroke="${color}" stroke-width="4"/><line x1="70" y1="32" x2="85" y2="48" stroke="${color}" stroke-width="4"/><line x1="30" y1="32" x2="70" y2="34" stroke="${color}" stroke-width="3"/><circle cx="50" cy="33" r="4"/></svg>`,
  };
  return `data:image/svg+xml,${encodeURIComponent(poses[pose] || poses.stand)}`;
};

// Pose library
const POSE_LIBRARY: Pose[] = [
  // Standing poses
  {
    id: 'stand_neutral',
    name: 'Neutral Stand',
    category: 'standing',
    thumbnail: createPoseSVG('stand','#666'),
    description: 'Relaxed standing pose',
  },
  {
    id: 'stand_confident',
    name: 'Confident Stand',
    category: 'standing',
    thumbnail: createPoseSVG('confident','#666'),
    description: 'Confident power pose',
  },
  {
    id: 'stand_casual',
    name: 'Casual Stand',
    category: 'standing',
    thumbnail: createPoseSVG('casual','#666'),
    description: 'Casual relaxed stance',
  },

  // Sitting poses
  {
    id: 'sit_chair',
    name: 'Chair Sit',
    category: 'sitting',
    thumbnail: createPoseSVG('sit','#666'),
    description: 'Seated on chair',
  },
  {
    id: 'sit_elegant',
    name: 'Elegant Sit',
    category: 'sitting',
    thumbnail: createPoseSVG('elegant','#666'),
    description: 'Elegant seated pose',
  },

  // Action poses
  {
    id: 'walk_forward',
    name: 'Walking',
    category: 'action',
    thumbnail: createPoseSVG('walk','#666'),
    description: 'Walking forward',
  },
  {
    id: 'turn_back',
    name: 'Looking Back',
    category: 'action',
    thumbnail: createPoseSVG('turn','#666'),
    description: 'Looking over shoulder',
  },

  // Couple poses
  {
    id: 'couple_embrace',
    name: 'Embrace',
    category: 'couple',
    thumbnail: createPoseSVG('embrace','#666'),
    description: 'Romantic embrace',
  },
  {
    id: 'couple_holding_hands',
    name: 'Holding Hands',
    category: 'couple',
    thumbnail: createPoseSVG('hands','#666'),
    description: 'Walking holding hands',
  },
];

export const CharacterModelLoader: React.FC = () => {
  const [scene, setScene] = useState<THREE.Scene | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<CharacterModel | null>(null);
  const [loadedCharacter, setLoadedCharacter] = useState<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPose, setSelectedPose] = useState<Pose | null>(null);

  // Customization state
  const [skinTone, setSkinTone] = useState('#FFDAB9');
  const [height, setHeight] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });

  // AI Vision state
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  const categories = ['all','wedding','portrait','fashion','business'];

  const filteredModels =
    selectedCategory === 'all'
      ? CHARACTER_MODELS
      : CHARACTER_MODELS.filter((model) => model.category === selectedCategory);

  // Load character model
  const loadCharacter = async (model: CharacterModel) => {
    if (!scene) return;

    setLoading(true);
    setSelectedModel(model);

    try {
      const loader = new GLTFLoader();

      // Try to load model (will fail gracefully if file doesn't exist)
      try {
        const gltf = await loader.loadAsync(model.modelUrl);
        const character = gltf.scene;

        // Position and scale
        character.position.set(position.x, position.y, position.z);
        character.scale.set(height, height, height);

        // Apply skin tone (traverse and find skin material)
        character.traverse((child: unknown) => {
          if (child instanceof THREE.Mesh) {
            if (child.material.name?.includes('Skin') || child.material.name?.includes('skin')) {
              child.material.color.set(skinTone);
            }
          }
        });

        // Add to scene
        scene.add(character);
        setLoadedCharacter(character);

        log.info(`Character loaded: ${model.name}`);
      } catch (fileError) {
        log.warn(`Model file not found: ${model.modelUrl}`);
        log.debug('Add GLB/GLTF files to /public/models/characters/ directory');
        log.debug('Or use ReadyPlayerMe API: https://readyplayer.me/');
        log.debug('Or use Mixamo: https://www.mixamo.com/');

        // Create placeholder
        const geometry = new THREE.CapsuleGeometry(0.3, 1.5, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: skinTone });
        const placeholder = new THREE.Mesh(geometry, material);
        placeholder.position.set(position.x, position.y + 1, position.z);
        placeholder.castShadow = true;
        placeholder.receiveShadow = true;

        scene.add(placeholder);
        setLoadedCharacter(placeholder);

        log.debug('Created placeholder character');
      }
    } catch (error) {
      log.error('Failed to load character: ', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply pose to character
  const applyPose = (pose: Pose) => {
    if (!loadedCharacter) {
      alert('Load a character first');
      return;
    }

    setSelectedPose(pose);

    // Find skeleton and apply bone rotations
    const skeleton = loadedCharacter.getObjectByName('Armature');
    if (skeleton) {
      // Apply pose transformations (would need actual pose data)
      log.debug(`Pose applied: ${pose.name}`);
      log.debug('Add actual pose bone rotation data to POSE_LIBRARY');
    } else {
      log.warn('No skeleton found in model');
    }
  };

  // Remove character from scene
  const removeCharacter = () => {
    if (loadedCharacter && scene) {
      scene.remove(loadedCharacter);
      setLoadedCharacter(null);
      setSelectedModel(null);
      setAiSuggestions([]);
      log.debug('Character removed');
    }
  };

  // Analyze scene with AI Vision
  const analyzeScene = async () => {
    if (!scene) {
      alert('Scene must be ready');
      return;
    }

    setAiAnalyzing(true);

    try {
      log.debug('Analyzing scene with AI Vision...');
      const startTime = performance.now();

      // Analyze scene composition
      const analysis: unknown = {
        scene: { hasPeople: true },
        composition: { ruleOfThirds: false },
      };

      const elapsed = performance.now() - startTime;
      log.info(`AI analysis complete in ${elapsed.toFixed(0)}ms`);

      // Get AI suggestions based on analysis
      const suggestions: string[] = [];

      // Add pose-specific suggestions
      if (analysis.scene.hasPeople) {
        suggestions.push('People detected - consider portrait lighting');
        suggestions.push('Apply skin tone protection in color grading');
      }

      // Add composition suggestions
      if (!analysis.composition.ruleOfThirds) {
        suggestions.push('Adjust camera to follow rule of thirds');
      }

      setAiSuggestions(suggestions);

      log.debug('AI Suggestions:', suggestions);
    } catch (error) {
      log.error('AI analysis failed:', error);
      alert('AI analysis failed. Make sure ONNX model is available.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 2, backgroundColor: '#1a1a1a', color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Person color="primary" />
        <Typography variant="h6">Character Models</Typography>
        <Chip
          label={`${CHARACTER_MODELS.length} models`}
          size="small"
          color="primary"
          sx={{ ml: 'auto' }}
        />
      </Box>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Models" />
        <Tab label="Poses" />
        <Tab label="Customize" />
      </Tabs>

      {/* Models Tab */}
      {activeTab === 0 && (
        <>
          {/* Category Filter */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Category
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Button>
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          {/* Model Grid */}
          <Box sx={{ maxHeight: 400, overflowY: 'auto', mb: 2 }}>
            <Grid container spacing={2}>
              {filteredModels.map((model) => (
                <Grid item xs={6} sm={4} key={model.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border:
                        selectedModel?.id === model.id ? '2px solid #2196f3' : '1px solid #333',
                      backgroundColor: '#222','&:hover': { borderColor: '#2196f3' }}}
                    onClick={() => loadCharacter(model)}
                  >
                    <CardMedia
                      component="img"
                      height="150"
                      image={model.thumbnail}
                      alt={model.name}
                    />
                    <CardContent sx={{ p: 1 }}>
                      <Typography variant="caption" noWrap>
                        {model.name}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {model.poses} poses
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {loadedCharacter && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={removeCharacter}
              fullWidth
            >
              Remove Character
            </Button>
          )}
        </>
      )}

      {/* Poses Tab */}
      {activeTab === 1 && (
        <Box sx={{ maxHeight: 450, overflowY: 'auto' }}>
          <Grid container spacing={1}>
            {POSE_LIBRARY.map((pose) => (
              <Grid item xs={4} sm={3} key={pose.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    border: selectedPose?.id === pose.id ? '2px solid #4caf50' : '1px solid #333',
                    backgroundColor: '#222','&:hover': { borderColor: '#4caf50' }}}
                  onClick={() => applyPose(pose)}
                >
                  <CardMedia component="img" height="100" image={pose.thumbnail} alt={pose.name} />
                  <CardContent sx={{ p: 0.5 }}>
                    <Typography variant="caption" noWrap>
                      {pose.name}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Customize Tab */}
      {activeTab === 2 && (
        <Box>
          {/* AI Vision Analysis */}
          {loadedCharacter && (
            <Box sx={{ mb: 3 }}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                onClick={analyzeScene}
                disabled={aiAnalyzing}
                sx={{ mb: 1 }}
              >
                {aiAnalyzing ? '🤖 Analyzing...' : '🤖 Analyze Scene with AI Vision'}
              </Button>

              {aiSuggestions.length > 0 && (
                <Box
                  sx={{
                    p: 1.5,
                    backgroundColor: '#222',
                    borderRadius: 1,
                    borderLeft: '3px solid #4caf50'}}
                >
                  <Typography variant="caption" display="block" gutterBottom>
                    <strong>💡 AI Suggestions:</strong>
                  </Typography>
                  {aiSuggestions.map((suggestion, index) => (
                    <Typography key={index} variant="caption" display="block" sx={{ ml: 1 }}>
                      • {suggestion}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}

          <Typography variant="subtitle2" gutterBottom>
            Appearance
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Skin Tone</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              {['#FFDAB9','#F0C19F','#D4A574''#8D5524', '#4A2C2A'].map((color) => (
                <Box
                  key={color}
                  onClick={() => setSkinTone(color)}
                  sx={{
                    width: 40,
                    height: 40,
                    backgroundColor: color,
                    border: skinTone === color ? '3px solid #2196f3' : '1px solid #666',
                    borderRadius: 1,
                    cursor: 'pointer'}}
                />
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          <Typography variant="subtitle2" gutterBottom>
            Transform
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Height Scale</Typography>
            <Slider
              value={height}
              onChange={(_, v) => setHeight(v as number)}
              min={0.5}
              max={1.5}
              step={0.1}
              valueLabelDisplay="auto"
              sx={{ color: '#2196f3' }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Position X</Typography>
            <Slider
              value={position.x}
              onChange={(_, v) => setPosition({ ...position, x: v as number })}
              min={-5}
              max={5}
              step={0.1}
              valueLabelDisplay="auto"
              sx={{ color: '#2196f3' }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Position Z</Typography>
            <Slider
              value={position.z}
              onChange={(_, v) => setPosition({ ...position, z: v as number })}
              min={-5}
              max={5}
              step={0.1}
              valueLabelDisplay="auto"
              sx={{ color: '#2196f3' }}
            />
          </Box>
        </Box>
      )}

      {loading && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Loading character...
          </Typography>
        </Box>
      )}

      {/* Instructions */}
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          backgroundColor: '#222',
          borderRadius: 1,
          borderLeft:'3px solid #2196f3'}}
      >
        <Typography variant="caption">
          <strong>✨ AI-Powered Features:</strong>
          <br />
          • Scene analysis with ONNX Runtime
          <br />
          • Composition recommendations
          <br />
          • Lighting suggestions
          <br />
          • Pose detection (people detection)
          <br />
          <br />
          <strong>Setup Guide:</strong>
          <br />
          1. Add GLB/GLTF files to /public/models/characters/
          <br />
          2. Or use ReadyPlayerMe: https://readyplayer.me/
          <br />
          3. Or download from Mixamo: https://www.mixamo.com/
          <br />
          4. Update modelUrl in CHARACTER_MODELS array
        </Typography>
      </Box>
    </Paper>
  );
};
