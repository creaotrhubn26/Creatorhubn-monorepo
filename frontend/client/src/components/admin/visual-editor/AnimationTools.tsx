/**
 * Animation Tools Component
 * ScrollStory creation, animation presets, timeline management
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import { useScrollStory } from '../../scroll-story/useScrollStory';
import {
  Box,
  Typography,
  Paper,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tab,
  Tabs,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Card,
  CardContent,
  Slider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Divider,
  IconButton,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Timeline,
  VideoLibrary,
  Collections as Images,
  Animation,
  ViewStream,
  PaletteTwoTone,
  SpeedRounded,
  Loop,
} from '@mui/icons-material';

interface AnimationToolsProps {
  selectedProject?: { id: string; name?: string };
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void; 
}

export const AnimationTools: React.FC<AnimationToolsProps> = ({
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  const [activeTab, setActiveTab] = useState(0);

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('animation_tools_render,');
    
    lifecycle.registerComponent({
      id: 'AnimationTools',
      type: 'animation-tools',
      version: '1.0.0',
      capabilities: {
        data: ['animation:create','preset:manage','timeline:edit','scrollstory:create'],
        events: ['animation:created','preset:applied','timeline:updated'],
        actions: ['animation:create','preset:apply','timeline:edit','scrollstory:create'],
        ui: ['animation:display','preset:show','timeline:interface'],
        system: ['performance:monitor','analytics:track','debug:log']
      },
      dependencies: ['@mui/material','EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    analytics.trackEvent('animation_tools_mounted', {
      componentId: 'AnimationTools',
      projectId: selectedProject?.id,
      timestamp: Date.now()
    });

    debugging.logIntegration('info', 'AnimationTools component mounted', {
      componentId: 'AnimationTools',
      projectId: selectedProject?.id
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('AnimationTools');
      analytics.trackEvent('animation_tools_unmounted', {
        componentId: 'AnimationTools',
        timestamp: Date.now()
      });
    };
  }, [analytics, lifecycle, performance, debugging, selectedProject?.id]);

  const [animationPresets, setAnimationPresets] = useState([
    { id: 'fadeIn', name: 'Fade In', duration: 300, easing: 'ease-in' },
    { id: 'slideUp', name: 'Slide Up', duration: 500, easing: 'ease-out' },
    { id: 'bounce', name: 'Bounce', duration: 800, easing: 'ease-out' },
    { id: 'spin', name: 'Spin', duration: 600, easing: 'linear' }
  ]);
  const [selectedPreset, setSelectedPreset] = useState<Record<string, unknown> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStory, setCurrentStory] = useState<Record<string, unknown> | null>(null);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);
  const [animationLayers, setAnimationLayers] = useState<Record<string, unknown>[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  
  // ScrollStory functionality - using the real hook
  const {
    scrollStories,
    currentStory: scrollCurrentStory,
    createStory,
    previewStory,
    stopPreview,
    scrollProgress,
    isScrollPreview,
    addScrollTrigger,
    addScrollAnimation,
    setScrollProgress
  } = useScrollStory();

  // Animation Functions from original file
  const handleApplyAnimation = useCallback((element: string, preset: Record<string, unknown>) => {
    setSelectedPreset(preset);

    onNotificationCreate?.({
      id: `animation_applied_${Date.now()}`,
      type: 'project_updated',
      title: 'Animation Applied',
      message: `${preset.name} animation applied`,
      priority: 'low',
      source: 'visual_editor',
      timestamp: new Date().toISOString()
    });
  }, [onNotificationCreate]);

  const createScrollStoryFromAnimation = useCallback(() => {
    if (!animationLayers.length) return;

    try {
      const scrollStory = {
        id: `story_${Date.now()}`,
        layers: animationLayers,
        duration: 500,
        elements: [],
        settings: {
          autoPlay: false,
          loupEnabled: true,
          timeline: 'continuous'
        }
      };

      setCurrentStory(scrollStory);

      onNotificationCreate?.({
        id: `scroll_story_created_${Date.now()}`,
        type: 'scroll_story_created',
        title: 'Scroll Story Created',
        message: 'Animation story generated successfully',
        priority: 'medium',
        source: 'visual_editor',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Failed to create scroll story: ', error);
    }
  }, [animationLayers, onNotificationCreate]);

  const timelineClick = useCallback((position: number) => {
    const elementId = 'animation_timeline';
    const time = position * 100; // Convert normalized position to time
    setSelectedKeyframe(`${elementId}_${time}_key${Date.now()}`);
  }, []);

  return (
    <Paper sx={{ p: 3, m: 2, ...theming.getThemedCardSx() }}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        {theming.getThemedIcon('videoLibrary')}
        Animation & ScrollStory Tools
      </Typography>

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
        <Tab label="Presets" />
        <Tab label="Timeline" />
        <Tab label="ScrollStory" />
        <Tab label="Preview" />
      </Tabs>

      {/* Animation Presets */}
      {activeTab === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Animation Presets</Typography>
          <Grid container spacing={2}>
            {animationPresets.map((preset) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={preset.id}>
                <Card
                  sx={{ cursor: 'pointer', ...theming.getThemedCardSx() }}
                  onClick={() => handleApplyAnimation('selected_element', preset)}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <PlayArrow color="primary" />
                      <Typography variant="subtitle2" noWrap>
                        {preset.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {preset.duration}ms • {preset.easing}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Advanced Settings</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Duration</InputLabel>
            <Select value="500">
              <MenuItem value="300">Fast (300ms)</MenuItem>
              <MenuItem value="500">Medium (500ms)</MenuItem>
              <MenuItem value="800">Slow (800ms)</MenuItem>
              <MenuItem value="1200">Very Slow (1200ms)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Easing</InputLabel>
            <Select value="ease-out">
              <MenuItem value="linear">Linear</MenuItem>
              <MenuItem value="ease-in">Ease In</MenuItem>
              <MenuItem value="ease-out">Ease Out</MenuItem>
              <MenuItem value="ease-in-out">Ease In/Out</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Timeline Editor */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Animation Timeline</Typography>

          {/* Timeline Controls */}
          <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
            <Button
              variant="contained"
              startIcon={isPlaying ? theming.getThemedIcon('stop') : theming.getThemedIcon('play')}
              onClick={() => setIsPlaying(!isPlaying)}
              sx={theming.getThemedButtonSx()}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>

            <Slider
              min={0}
              max={100}
              value={scrollProgress * 100}
              onChange={(_, value) => timelineClick((value as number) / 100)}
              sx={{ flex: 1 }}
            />

            <Typography variant="caption" noWrap>
              {Math.round(scrollProgress * 100)}%
            </Typography>
          </Box>

          {/* Layer List */}
          <List component="div">
            {animationLayers.map((layer, index) => (
              <ListItem key={index} divider>
                <ListItemIcon>
                  {theming.getThemedIcon('timeline')}
                </ListItemIcon>
                <ListItemText
                  primary={layer.name}
                  secondary={`Keyframes: ${layer.keyframes?.length || 0}`}
                />
              </ListItem>
            ))}
          </List>

          <Button variant="outlined" fullWidth sx={{ mt: 2 }}>
            Add Animation Layer
          </Button>
        </Box>
      )}

      {/* ScrollStory Builder */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>ScrollStory Builder</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Create interactive scroll-triggered animations and narratives
          </Typography>

          {currentStory ? (
            <Card sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
              <Typography variant="subtitle2" gutterBottom>
                Current Story Settings
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="caption">
                  Duration: {currentStory.duration}ms
                </Typography>
                <Chip
                  label={currentStory.settings.loopEnabled ? 'Loop On' : 'Loop Off'}
                  size="small"
                />
              </Box>
            </Card>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              Create animations in the Timeline tab first, then build them into a ScrollStory
            </Alert>
          )}

          <Button variant="contained"
            onClick={createScrollStoryFromAnimation}
            disabled={!animationLayers.length}
            startIcon={<ViewStream />}
            sx={{ mb: 2 }}
          >
            Create ScrollStory
          </Button>

          <Typography variant="subtitle2" gutterBottom>Timeline Settings</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />
            }
            label="Respect User Animation Preferences"
          />
        </Box>
      )}

      {/* Preview Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Scroll Preview</Typography>

          <Box sx={{
            height: 300,
            border: '2px dashed #ccc',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9f9f9'
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
              Scroll Story Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Preview your scroll-triggered animations
            </Typography>

            <ButtonGroup>
              <Button
                variant="contained"
                startIcon={theming.getThemedIcon('play')}
                disabled={isPlaying}
                onClick={() => previewStory(scrollCurrentStory?.id || ', ')}
                sx={theming.getThemedButtonSx()}
              >
                {isPlaying ? 'Playing...' : 'Preview'}
              </Button>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('stop')}
                onClick={stopPreview}
              >
                Stop
              </Button>
            </ButtonGroup>

            {isPlaying && (
              <Box sx={{ mt: 2, width: '100%', px: 2 }}>
                <LinearProgress variant="determinate" value={scrollProgress * 100} />
                <Typography variant="caption" sx={{ mt: 1, display:'block' }}>
                  Progress: {Math.round(scrollProgress * 100)}%
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default AnimationTools;
