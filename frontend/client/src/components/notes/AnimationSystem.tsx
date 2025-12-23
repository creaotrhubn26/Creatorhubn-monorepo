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
  Fade,
  Slide,
  Zoom,
  Grow,
  Collapse,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface AnimationConfig {
  id: string;
  name: string;
  description: string;
  type: 'fade' | 'slide' | 'zoom' | 'grow' | 'collapse' | 'custom';
  duration: number;
  easing: string;
  delay: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  scale?: number;
  enabled: boolean
}

interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  animations: AnimationConfig[];
  category: 'entrance' | 'exit' | 'attention' | 'transition'
}

interface AnimationSystemProps {
  className?: string;
  onAnimationChange?: (animation: AnimationConfig) => void;
  onPresetSave?: (preset: AnimationPreset) => void;
  onAnimationExport?: (animations: AnimationConfig[]) => void
}

// Mock data
const defaultAnimations: AnimationConfig[] = [
  {
    id: 'fade-in',
    name: 'Fade I',
    description: 'Smooth fade in effect',
    type: 'fade',
    duration: 30,
    easing: 'ease-in-out',
    delay:  0,
    enabled: true
},
  {
    id: 'slide-up',
    name: 'Slide U',
    description: 'Slide in from bottom',
    type: 'slide',
    duration: 40,
    easing: 'ease-out',
    delay:  0,
    direction: 'up',
    enabled: true
},
  {
    id: 'zoom-in',
    name: 'Zoom I',
    description: 'Zoom in from center',
    type: 'zoom',
    duration: 30,
    easing: 'ease-out',
    delay:  0,
    scale: 1.1,
    enabled: true
},
  {
    id: 'grow',
    name: 'Grow',
    description: 'Grow from small to normal size',
    type: 'grow',
    duration: 50,
    easing: 'ease-out',
    delay:  0,
    enabled: true
}
];

const animationPresets: AnimationPreset[] = [
  {
    id: 'entrance',
    name: 'Entrance Animations',
    description: 'Animations for when elements appear',
    category: 'entrance',
    animations: [
      {
        id: 'fade-in',
        name: 'Fade I',
        description: 'Smooth fade in effect',
        type: 'fade',
        duration: 30,
        easing: 'ease-in-out',
        delay:  0,
        enabled: true
  },
      {
        id: 'slide-up',
        name: 'Slide U',
        description: 'Slide in from bottom',
        type: 'slide',
        duration: 40,
        easing: 'ease-out',
        delay:  0,
        direction: 'up',
        enabled: true
  }
    ]
},
  {
    id: 'attention',
    name: 'Attention Animations',
    description: 'Animations to draw attention',
    category: 'attention',
    animations: [
      {
        id: 'pulse',
        name: 'Pulse',
        description: 'Pulsing effect',
        type: 'custom',
        duration: 100,
        easing: 'ease-in-out',
        delay:  0,
        enabled: true
  },
      {
        id: 'bounce',
        name: 'Bounce',
        description: 'Bouncing effect',
        type: 'custom',
        duration: 60,
        easing: 'ease-out',
        delay:  0,
        enabled: true
  }
    ]
}
];

const AnimationSystem: React.FC<AnimationSystemProps> = ({
  className ='',
  onAnimationChange,
  onPresetSave,
  onAnimationExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedAnimation, setSelectedAnimation] = useState<AnimationConfig | null>(null);
  const [showAnimationEditor, setShowAnimationEditor] = useState(false);
  const [animations, setAnimations] = useState<AnimationConfig[]>(defaultAnimations);
  const [presets, setPresets] = useState<AnimationPreset[]>(animationPresets);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewElement, setPreviewElement] = useState<AnimationConfig | null>(null);

  // Handlers
  const handleAnimationSelect = useCallback((animation: AnimationConfig) => {
    setSelectedAnimation(animation);
    onAnimationChange?.(animation);
}, [onAnimationChange]);

  const handleAnimationEdit = useCallback((animation: AnimationConfig) => {
    setSelectedAnimation(animation);
    setShowAnimationEditor(true);
}, []);

  const handleAnimationSave = useCallback(() => {
    if (selectedAnimation) {
      const existingIndex = animations.findIndex(a => a.id === selectedAnimation.id);
      if (existingIndex >= 0) {
        setAnimations(prev => prev.map((a, i) => i === existingIndex ? selectedAnimation : a));
    } else {
        setAnimations(prev => [...prev, selectedAnimation]);
    }
      setShowAnimationEditor(false);
  }
}, [selectedAnimation, animations]);

  const handleAnimationDelete = useCallback((animationId: string) => {
    setAnimations(prev => prev.filter(a => a.id !== animationId));
    if (selectedAnimation?.id === animationId) {
      setSelectedAnimation(null);
}
}, [selectedAnimation]);

  const handlePresetApply = useCallback((preset: AnimationPreset) => {
    setAnimations(prev => [...prev, ...preset.animations]);
}, []);

  const handlePresetSave = useCallback((preset: AnimationPreset) => {
    setPresets(prev => [...prev, preset]);
    onPresetSave?.(preset);
}, [onPresetSave]);

  const handleAnimationExport = useCallback(() => {
    onAnimationExport?.(animations);
}, [animations, onAnimationExport]);

  const handlePreview = useCallback((animation: AnimationConfig) => {
    setPreviewElement(animation);
    setPreviewMode(true);
    setTimeout(() => setPreviewMode(false), animation.duration + animation.delay);
}, []);

  const getAnimationIcon = useCallback((type: string) => {
    switch (type) {
      case 'fade': return <CREATOR_HUB_ICONS.visibility />;
      case 'slide': return <CREATOR_HUB_ICONS.swipe />;
      case 'zoom': return <CREATOR_HUB_ICONS.zoomIn />;
      case 'grow': return <CREATOR_HUB_ICONS.expandMore />;
      case 'collapse': return <CREATOR_HUB_ICONS.minimize />;
      case 'custom': return <CREATOR_HUB_ICONS.settings />;
      default: return <CREATOR_HUB_ICONS.playArrow />;
}
}, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'entrance': return <CREATOR_HUB_ICONS.playArrow />;
      case 'exit': return <CREATOR_HUB_ICONS.stop />;
      case 'attention': return <CREATOR_HUB_ICONS.star />;
      case 'transition': return <CREATOR_HUB_ICONS.swipe />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const renderAnimationPreview = useCallback((animation: AnimationConfig) => {
    const animationStyle = {
      animationDuration: `${animation.duration}ms`,
      animationDelay: `${animation.delay}ms`,
      animationTimingFunction: animation.easing,
      animationIterationCount: 'infinite'
};

    switch (animation.type) {
      case 'fade':
        return (
          <Fade in={previewMode} timeout={animation.duration}>
            <Box
              sx={{
                width: 10,
                height: 10,
                backgroundColor: 'primary.main',
                borderRadius:  1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
          }}
            >
              Fade
            </Box>
          </Fade>
        );
      case 'slide':
        return (
          <Slide
            direction={animation.direction || 'up'}
            in={previewMode}
            timeout={animation.duration}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                backgroundColor: 'secondary.main',
                borderRadius:  1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
          }}
            >
              Slide
            </Box>
          </Slide>
        );
      case 'zoom':
        return (
          <Zoom in={previewMode} timeout={animation.duration}>
            <Box
              sx={{
                width: 10,
                height: 10,
                backgroundColor: 'success.main',
                borderRadius:  1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
          }}
            >
              Zoom
            </Box>
          </Zoom>
        );
      case 'grow':
        return (
          <Grow in={previewMode} timeout={animation.duration}>
            <Box
              sx={{
                width: 10,
                height: 10,
                backgroundColor: 'warning.main',
                borderRadius:  1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
          }}
            >
              Grow
            </Box>
          </Grow>
        );
      default: return (
          <Box
            sx={{
              width: 10,
              height: 10,
              backgroundColor: 'info.main',
              borderRadius:  1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              ...animationStyle
          }}
          >
            Custom
          </Box>
        );
  }
}, [previewMode]);

  // Memoized data
  const animationCategories = useMemo(() => {
    const categories = [...new Set(animations.map(a => a.type))];
    return categories.map(category => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(),
      count: animations.filter(a => a.type === category).length
}));
}, [animations]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.playArrow sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Animation System</Typography>
              <Typography variant="body2" color="text.secondary">
                Advanced animation controls and presets
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedAnimation({
                  id: `animation-${Date.now()}`,
                  name: 'New Animation',
                  description: 'Custom animation',
                  type: 'fade',
                  duration: 30,
                  easing: 'ease-in-out',
                  delay:  0,
                  enabled: true
            });
                setShowAnimationEditor(true);
            }}
            >
              New Animation
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
              onClick={handleAnimationExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Animations" icon={<CREATOR_HUB_ICONS.playArrow />} />
        <Tab label="Presets" icon={<CREATOR_HUB_ICONS.star />} />
        <Tab label="Preview" icon={<CREATOR_HUB_ICONS.visibility />} />
      </Tabs>

      {/* Animations Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {animations.map((animation) => (
            <Grid item xs={12} sm={6} md={4} key={animation.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedAnimation?.id === animation.id ? 2 : 0,
                  borderColor: selectedAnimation?.id === animation.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleAnimationSelect(animation)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getAnimationIcon(animation.type)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {animation.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {animation.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={animation.type}
                          size="small" 
                          color="primary"
                        />
                        <Chip 
                          label={`${animation.duration}ms`}
                          size="small" 
                          variant="outlined"
                        />
                        <Chip 
                          label={animation.easing}
                          size="small" 
                          variant="outlined"
                        />
                      </Stack>
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.playArrow />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(animation);
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
                            handleAnimationEdit(animation);
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
                            handleAnimationDelete(animation.id);
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
                          label={`${preset.animations.length} animations`}
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
            Animation Preview
          </Typography>
          <Paper elevation={1} sx={{ p:  3, textAlign: 'center',  ...theming.getThemedCardSx() }}>
            <Box sx={{ minHeight: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              {previewElement ? renderAnimationPreview(previewElement) : (
                <Typography variant="body1" color="text.secondary">
                  Select an animation to preview
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt:  2 }}>
              {animations.map((animation) => (
                <Button
                  key={animation.id}
                  variant="outlined"
                  onClick={() => handlePreview(animation)}
                >
                  {animation.name}
                </Button>
              ))}
            </Stack>
          </Paper>
        </Box>
      )}

      {/* Animation Editor Dialog */}
      <Dialog open={showAnimationEditor} onClose={() => setShowAnimationEditor(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.settings />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedAnimation?.id.startsWith('animation-') ? 'Create Animation' : 'Edit Animation'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedAnimation && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Animation Name"
                value={selectedAnimation.name}
                onChange={(e) => setSelectedAnimation(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedAnimation.description}
                onChange={(e) => setSelectedAnimation(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth>
                <InputLabel>Animation Type</InputLabel>
                <Select
                  value={selectedAnimation.type}
                  onChange={(e) => setSelectedAnimation(prev => prev ? { ...prev, type: e.target.value as any } : null)}
                >
                  <MenuItem value="fade">Fade</MenuItem>
                  <MenuItem value="slide">Slide</MenuItem>
                  <MenuItem value="zoom">Zoom</MenuItem>
                  <MenuItem value="grow">Grow</MenuItem>
                  <MenuItem value="collapse">Collapse</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Duration: {selectedAnimation.duration}ms
                </Typography>
                <Slider
                  value={selectedAnimation.duration}
                  onChange={(_, value) => setSelectedAnimation(prev => prev ? { ...prev, duration: value } : null)}
                  min={100}
                  max={2000}
                  step={50}
                />
              </Box>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Delay: {selectedAnimation.delay}ms
                </Typography>
                <Slider
                  value={selectedAnimation.delay}
                  onChange={(_, value) => setSelectedAnimation(prev => prev ? { ...prev, delay: value } : null)}
                  min={0}
                  max={1000}
                  step={50}
                />
              </Box>
              <FormControl fullWidth>
                <InputLabel>Easing</InputLabel>
                <Select
                  value={selectedAnimation.easing}
                  onChange={(e) => setSelectedAnimation(prev => prev ? { ...prev, easing: e.target.value } : null)}
                >
                  <MenuItem value="ease">Ease</MenuItem>
                  <MenuItem value="ease-in">Ease In</MenuItem>
                  <MenuItem value="ease-out">Ease Out</MenuItem>
                  <MenuItem value="ease-in-out">Ease In Out</MenuItem>
                  <MenuItem value="linear">Linear</MenuItem>
                  <MenuItem value="cubic-bezier(0.40.2, 1)">Material Design</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedAnimation.enabled}
                    onChange={(e) => setSelectedAnimation(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                  />
              }
                label="Enabled"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnimationEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleAnimationSave}
           sx={theming.getThemedButtonSx()}>
            {selectedAnimation?.id.startsWith('animation-') ? 'Create' : 'Update'} Animation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnimationSystem;

