import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  LinearProgress,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface VisualEffect {
  id: string;
  name: string;
  description: string;
  type: 'particle' | 'gradient' | 'blur' | 'glow' | 'shadow' | 'transform' | 'filter';
  intensity: number;
  duration: number;
  enabled: boolean;
  config: Record<string, any>;
}

interface EffectPreset {
  id: string;
  name: string;
  description: string;
  effects: VisualEffect[];
  category: 'ambient' | 'interactive' | 'decorative' | 'functional'
}

interface VisualEffectsProps {
  className?: string;
  onEffectChange?: (effect: VisualEffect) => void;
  onPresetApply?: (preset: EffectPreset) => void;
  onEffectExport?: (effects: VisualEffect[]) => void
}

// Mock data
const defaultEffects: VisualEffect[] = [
  {
    id: 'particle-rain',
    name: 'Particle Rain',
    description: 'Falling particle effect',
    type: 'particle',
    intensity: 0.7,
    duration: 500,
    enabled: true,
    config: {
      particleCount: 50,
      speed:  2,
      color: '#ffffff',
      size: 2 }
},
  {
    id: 'gradient-bg',
    name: 'Gradient Background',
    description: 'Animated gradient background',
    type: 'gradient',
    intensity: 0.5,
    duration: 300,
    enabled: true,
    config: {
      colors: ['#ff6b60', '#4ecdc4','#45b7d1'],
      direction: 'diagonal',
      animation: 'wave'
}
},
  {
    id: 'blur-focus',
    name: 'Blur Focus',
    description: 'Blur effect for focus areas',
    type: 'blur',
    intensity: 0.8,
    duration: 20,
    enabled: false,
    config: {
      radius: 10,
      target: 'background'
}
},
  {
    id: 'glow-hover',
    name: 'Glow Hover',
    description: 'Glow effect on hover',
    type: 'glow',
    intensity: 0.6,
    duration: 30,
    enabled: true,
    config: {
      color: '#1976d0',
      radius:  20,
      spread: 5 }
},
  {
    id: 'shadow-elevation',
    name: 'Shadow Elevation',
    description: 'Dynamic shadow based on elevation',
    type: 'shadow',
    intensity: 0.4,
    duration:  0,
    enabled: true,
    config: {
      offsetX: 0,
      offsetY:  4,
      blur:  8,
      spread:  0,
      color: 'rgba(0,0,0,0.1)'
  }
}
];

const effectPresets: EffectPreset[] = [
  {
    id: 'ambient',
    name: 'Ambient Effects',
    description: 'Subtle background effects',
    category: 'ambient',
    effects: [
      {
        id: 'particle-rain',
        name: 'Particle Rain',
        description: 'Falling particle effect',
        type: 'particle',
        intensity: 0.3,
        duration: 500,
        enabled: true,
        config: {
          particleCount: 20,
          speed:  1,
          color: '#ffffff',
          size: 1 }
    }
    ]
},
  {
    id: 'interactive',
    name: 'Interactive Effects',
    description: 'Effects that respond to user interaction',
    category: 'interactive',
    effects: [
      {
        id: 'glow-hover',
        name: 'Glow Hover',
        description: 'Glow effect on hover',
        type: 'glow',
        intensity: 0.8,
        duration: 30,
        enabled: true,
        config: {
          color: '#1976d0',
          radius:  25,
          spread: 8 }
    }
    ]
}
];

const VisualEffects: React.FC<VisualEffectsProps> = ({
  className ='',
  onEffectChange,
  onPresetApply,
  onEffectExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedEffect, setSelectedEffect] = useState<VisualEffect | null>(null);
  const [showEffectEditor, setShowEffectEditor] = useState(false);
  const [effects, setEffects] = useState<VisualEffect[]>(defaultEffects);
  const [presets, setPresets] = useState<EffectPreset[]>(effectPresets);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewEffect, setPreviewEffect] = useState<VisualEffect | null>(null);

  // Handlers
  const handleEffectSelect = useCallback((effect: VisualEffect) => {
    setSelectedEffect(effect);
    onEffectChange?.(effect);
}, [onEffectChange]);

  const handleEffectEdit = useCallback((effect: VisualEffect) => {
    setSelectedEffect(effect);
    setShowEffectEditor(true);
}, []);

  const handleEffectSave = useCallback(() => {
    if (selectedEffect) {
      const existingIndex = effects.findIndex(e => e.id === selectedEffect.id);
      if (existingIndex >= 0) {
        setEffects(prev => prev.map((e, i) => i === existingIndex ? selectedEffect : e));
    } else {
        setEffects(prev => [...prev, selectedEffect]);
    }
      setShowEffectEditor(false);
  }
}, [selectedEffect, effects]);

  const handleEffectDelete = useCallback((effectId: string) => {
    setEffects(prev => prev.filter(e => e.id !== effectId));
    if (selectedEffect?.id === effectId) {
      setSelectedEffect(null);
}
}, [selectedEffect]);

  const handlePresetApply = useCallback((preset: EffectPreset) => {
    setEffects(prev => [...prev, ...preset.effects]);
    onPresetApply?.(preset);
}, [onPresetApply]);

  const handleEffectExport = useCallback(() => {
    onEffectExport?.(effects);
}, [effects, onEffectExport]);

  const handlePreview = useCallback((effect: VisualEffect) => {
    setPreviewEffect(effect);
    setPreviewMode(true);
    setTimeout(() => setPreviewMode(false), effect.duration || 2000);
}, []);

  const getEffectIcon = useCallback((type: string) => {
    switch (type) {
      case 'particle': return <CREATOR_HUB_ICONS.star />;
      case 'gradient': return <CREATOR_HUB_ICONS.palette />;
      case 'blur': return <CREATOR_HUB_ICONS.blur />;
      case 'glow': return <CREATOR_HUB_ICONS.lightbulb />;
      case 'shadow': return <CREATOR_HUB_ICONS.shadow />;
      case 'transform': return <CREATOR_HUB_ICONS.transform />;
      case 'filter': return <CREATOR_HUB_ICONS.filter />;
      default: return <CREATOR_HUB_ICONS.settings />;
}
}, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'ambient': return <CREATOR_HUB_ICONS.visibility />;
      case 'interactive': return <CREATOR_HUB_ICONS.touchApp />;
      case 'decorative': return <CREATOR_HUB_ICONS.palette />;
      case 'functional': return <CREATOR_HUB_ICONS.build />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const renderEffectPreview = useCallback((effect: VisualEffect) => {
    const effectStyle = {
      width: 20,
      height: 10,
      borderRadius:  8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      position: 'relative' as const,
      overflow: 'hidden' as const
};

    switch (effect.type) {
      case 'particle':
        return (
          <Box sx={effectStyle} style={{ background: 'linear-gradient(45deg, #1976d2, #42a5f5)' }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Particle Effect</Typography>
            {previewMode && (
              <Box
                sx={{
                  position: 'absolute',
                  top:  0,
                  left:  0,
                  right:  0,
                  bottom:  0,
                  background: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  animation: 'particle-rain 1s linear infinite'
            }}
              />
            )}
          </Box>
        );
      case 'gradient':
        return (
          <Box 
            sx={effectStyle}
            style={{ 
              background: `linear-gradient(45deg, ${effect.config.colors?.join(', ') || '#ff6b6b, #4ecdc4'})`,
              animation: previewMode ? 'gradient-shift 2s ease-in-out infinite' : 'none'
        }}
          >
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Gradient</Typography>
          </Box>
        );
      case 'blur':
        return (
          <Box 
            sx={effectStyle}
            style={{ 
              background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
              filter: previewMode ? `blur(${effect.config.radius || 5}px)` : 'none'
          }}
          >
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Blur Effect</Typography>
          </Box>
        );
      case 'glow':
        return (
          <Box 
            sx={effectStyle}
            style={{ 
              background: '#1976d0',
              boxShadow: previewMode ? `0 0 ${effect.config.radius || 20}px ${effect.config.color || '#1976d2'}` : 'none'
          }}
          >
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Glow Effect</Typography>
          </Box>
        );
      case 'shadow':
        return (
          <Box 
            sx={effectStyle}
            style={{ 
              background: '#1976d0',
              boxShadow: `${effect.config.offsetX || 0}px ${effect.config.offsetY || 4}px ${effect.config.blur || 8}px ${effect.config.color || 'rgba(0,0,0,0.1)'}`
          }}
          >
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Shadow</Typography>
          </Box>
        );
      default: return (
          <Box sx={effectStyle} style={{ background: '#666'}}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Custom Effect</Typography>
          </Box>
        );
  }
}, [previewMode]);

  // Memoized data
  const effectCategories = useMemo(() => {
    const categories = [...new Set(effects.map(e => e.type))];
    return categories.map(category => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(),
      count: effects.filter(e => e.type === category).length
}));
}, [effects]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.palette sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Visual Effects</Typography>
              <Typography variant="body2" color="text.secondary">
                Advanced visual effects and animations
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedEffect({
                  id: `effect-${Date.now()}`,
                  name: 'New Effect',
                  description: 'Custom visual effect',
                  type: 'particle',
                  intensity: 0.5,
                  duration: 100,
                  enabled: true,
                  config:  , {}
              });
                setShowEffectEditor(true);
            }}
            >
              New Effect
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
              onClick={handleEffectExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Effects" icon={<CREATOR_HUB_ICONS.palette />} />
        <Tab label="Presets" icon={<CREATOR_HUB_ICONS.star />} />
        <Tab label="Preview" icon={<CREATOR_HUB_ICONS.visibility />} />
      </Tabs>

      {/* Effects Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {effects.map((effect) => (
            <Grid item xs={12} sm={6} md={4} key={effect.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedEffect?.id === effect.id ? 2 : 0,
                  borderColor: selectedEffect?.id === effect.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleEffectSelect(effect)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getEffectIcon(effect.type)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {effect.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {effect.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={effect.type}
                          size="small" 
                          color="primary"
                        />
                        <Chip 
                          label={`${Math.round(effect.intensity * 100)}%`}
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={effect.enabled ? 'On' : 'Off'}
                          size="small" 
                          color={effect.enabled ? 'success' : 'default'}
                        />
                      </Stack>
                      
                      <LinearProgress 
                        variant="determinate" 
                        value={effect.intensity * 100}
                        sx={{ mb: 2, height:  4, borderRadius:  2 }}
                      />
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.playArrow />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(effect);
                        }}
                        >
                          Preview
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEffectEdit(effect);
                        }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<CREATOR_HUB_ICONS.delete />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEffectDelete(effect.id);
                        }}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Presets Tab */}
      {activeTab === 1 && (
        <Grid container spacing={2}>
          {presets.map((preset) => (
            <Grid item xs={12} sm={6} md={4} key={preset.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getCategoryIcon(preset.category)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {preset.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {preset.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={preset.category}
                          size="small" 
                          color="secondary"
                        />
                        <Chip 
                          label={`${preset.effects.length} effects`}
                          size="small" 
                          variant="outlined"
                        />
                      </Stack>
                      
                      <Button size="small"
                        variant="contained"
                        startIcon={<CREATOR_HUB_ICONS.add sx={theming.getThemedButtonSx()} />}
                        onClick={() => handlePresetApply(preset)}
                      >
                        Apply Preset
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Preview Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Effect Preview
          </Typography>
          <Paper elevation={1} sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
            <Box sx={{ minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {previewEffect ? renderEffectPreview(previewEffect) : (
                <Typography variant="body1" color="text.secondary">
                  Select an effect to preview
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt:  2 }}>
              {effects.map((effect) => (
                <Button
                  key={effect.id}
                  variant="outlined"
                  onClick={() => handlePreview(effect)}
                >
                  {effect.name}
                </Button>
              ))}
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Effect Editor Dialog */}
      <Dialog open={showEffectEditor} onClose={() => setShowEffectEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.settings />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedEffect?.id.startsWith('effect-') ? 'Create Effect' : 'Edit Effect'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedEffect && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Effect Name"
                value={selectedEffect.name}
                onChange={(e) => setSelectedEffect(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedEffect.description}
                onChange={(e) => setSelectedEffect(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel>Effect Type</InputLabel>
                <Select
                  value={selectedEffect.type}
                  onChange={(e) => setSelectedEffect(prev => prev ? { ...prev, type: e.target.value as any } : null)}
                >
                  <MenuItem value="particle">Particle</MenuItem>
                  <MenuItem value="gradient">Gradient</MenuItem>
                  <MenuItem value="blur">Blur</MenuItem>
                  <MenuItem value="glow">Glow</MenuItem>
                  <MenuItem value="shadow">Shadow</MenuItem>
                  <MenuItem value="transform">Transform</MenuItem>
                  <MenuItem value="filter">Filter</MenuItem>
                </Select>
              </FormControl>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Intensity: {Math.round(selectedEffect.intensity * 10)}%
                </Typography>
                <Slider
                  value={selectedEffect.intensity}
                  onChange={(_, value) => setSelectedEffect(prev => prev ? { ...prev, intensity: value } : null)}
                  min={0}
                  max={1}
                  step={0.1}
                />
              </Box>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Duration: {selectedEffect.duration}ms
                </Typography>
                <Slider
                  value={selectedEffect.duration}
                  onChange={(_, value) => setSelectedEffect(prev => prev ? { ...prev, duration: value } : null)}
                  min={100}
                  max={10000}
                  step={100}
                />
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedEffect.enabled}
                    onChange={(e) => setSelectedEffect(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                  />
              }
                label="Enabled"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEffectEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleEffectSave}
           sx={theming.getThemedButtonSx()}>
            {selectedEffect?.id.startsWith('effect-') ? 'Create' : 'Update'} Effect
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisualEffects;

