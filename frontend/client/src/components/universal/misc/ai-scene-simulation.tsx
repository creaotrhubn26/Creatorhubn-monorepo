import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  Paper,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import {
  PlayArrow,
  Stop,
  Refresh,
  Visibility,
  Close,
  SmartToy,
  Movie,
  CameraAlt,
  Lightbulb,
} from '@mui/icons-material';

interface SceneSimulation {
  id: string;
  sceneId: string;
  title: string;
  description: string;
  simulationType: 'lighting' | 'camera' | 'composition' | 'mood' | 'movement';
  aiGenerated: boolean;
  confidence: number;
  preview: string;
  recommendations: string[];
  technicalSpecs: {
    cameraAngle: string;
    lighting: string;
    colorPalette: string[];
    movement: string;
    duration: number;
};
}

interface AiSceneSimulationProps {
  storyArcData?: any;
  projectId?: string;
  onSimulationComplete?: (simulation: SceneSimulation) => void
}

export default function AiSceneSimulation({ 
  storyArcData, 
  projectId,
  onSimulationComplete 
}: AiSceneSimulationProps) {
  const { user, auth } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [selectedScene, setSelectedScene] = useState<any>(null);
  const [showSimulationDialog, setShowSimulationDialog] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<SceneSimulation[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<SceneSimulation | null>(null);

  // Fetch existing simulations
  const { data: simulations = [], isLoading } = useQuery({
    queryKey: ['/api/scene-simulations', projectId],
    queryFn: async () => {
      return apiRequest(`/api/scene-simulations/${projectId || 'default'}`, {
        headers: {
          ...auth, 'Content-Type' : 'application/json'
        }
      });
    },
    retry: false,
  });

  // Generate AI simulation
  const generateSimulation = useMutation({
    mutationFn: async (sceneData: any) => {
      return apiRequest('/api/scene-simulations/generate', {
        headers: {
          ...auth, 'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({ 
          ...sceneData, 
          projectId,
          storyArcContext: storyArcData 
    })
    });
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scene-simulations", ],});
      setSimulationResults(prev => [...prev, data]);
      onSimulationComplete?.(data);
      setIsSimulating(false);
  },
    onError: () => {
      setIsSimulating(false);
}
});

  // Save simulation
  const saveSimulation = useMutation({
    mutationFn: async (simulation: SceneSimulation) => {
      return apiRequest('/api/scene-simulations/save', {
        headers: {
          "Content-Type": "application/json"
        },
        method: 'POST',
        body: JSON.stringify(simulation)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scene-simulations"] });
    }
  });

  // Generate simulation for a scene
  const handleGenerateSimulation = useCallback(async (scene: any) => {
    setSelectedScene(scene);
    setIsSimulating(true);
    
    try {
      await generateSimulation.mutateAsync({
        sceneId: scene.id,
        title: scene.title,
        description: scene.description,
        sceneType: scene.type || 'general',
        mood: scene.mood || 'neutral',
        location: scene.location || 'studio',
        timeOfDay: scene.timeOfDay || 'day',
        characters: scene.characters || [],
        props: scene.props || []
  });
  } catch (error) {
      console.error('Failed to generate simulation: ', error);
  }
}, [generateSimulation]);

  // Get simulation type icon
  const getSimulationTypeIcon = (type: string) => {
    switch (type) {
      case 'lighting': return <Lightbulb />;
      case 'camera': return <CameraAlt />;
      case 'composition': return <Visibility />;
      case 'mood': return <SmartToy />;
      case 'movement': return <Movie />;
      default: return theming.getThemedIcon('info');
  }
};

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
};

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
};

  return (
    <Box sx={{ p:  2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <SmartToy color="primary" />
          AI Scene Simulation
        </Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('refresh')}
          onClick={() => {
            if (storyArcData?.scenes?.length > 0) {
              setShowSimulationDialog(true);
          }
        }}
          disabled={!storyArcData?.scenes?.length}
        >
          Generate All Simulations
        </Button>
      </Box>

      {/* Story Arc Integration Alert */}
      {storyArcData && (
        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="body2">
            <strong>Story Arc Integration: </strong> AI will analyze your {storyArcData.scenes?.length || 0} scenes 
            and generate realistic simulations for lighting, camera work, and composition.
          </Typography>
        </Alert>
      )}

      {/* Scenes from Story Arc */}
      {storyArcData?.scenes && (
        <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Story Arc Scenes
            </Typography>
            <Grid container spacing={2}>
              {storyArcData.scenes.map((scene: any, index: number) => (
                <Grid item xs={2} sm={6} md={4} key={scene.id || index}>
                  <Paper 
                    sx={{ 
                      p: 2, cursor: 'pointer', '&:hover': { 
                        transform: 'translateY(-2px)',
                        boxShadow: 2 },
                      transition: 'all 0.2s ease-in-out'
                }}
                    onClick={() => handleGenerateSimulation(scene)}
                  >
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {scene.title || `Scene ${index + 1}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {scene.description || 'No description available'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                      {scene.mood && (
                        <Chip label={scene.mood} size="small" variant="outlined" />
                      )}
                      {scene.location && (
                        <Chip label={scene.location} size="small" variant="outlined" />
                      )}
                      {scene.timeOfDay && (
                        <Chip label={scene.timeOfDay} size="small" variant="outlined" />
                      )}
                    </Box>
                    <Button
                      size="small"
                      startIcon={theming.getThemedIcon('smartToy')}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateSimulation(scene);
                    }}
                      disabled={isSimulating}
                      sx={{ mt:  1 }}
                    >
                      {isSimulating ? 'Generating...' : 'Simulate'}
                    </Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Simulation Results */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
          <CircularProgress />
        </Box>
      ) : simulations.length === 0 ? (
        <Alert severity="info">
          No simulations generated yet. Select a scene to create AI-powered simulations.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {simulations.map((simulation: SceneSimulation) => (
            <Grid item xs={2} sm={6} md={4} key={simulation.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { 
                    transform: 'translateY(-4px)',
                    boxShadow: 4 },
                  transition: 'all 0.2s ease-in-out'
            }}
                onClick={() => setActiveSimulation(simulation)}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{simulation.title}</Typography>
                    <Chip 
                      icon={getSimulationTypeIcon(simulation.simulationType)}
                      label={simulation.simulationType} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                    {simulation.description}
                  </Typography>

                  {/* Confidence Score */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Typography variant="body2">Confidence: </Typography>
                    <Chip 
                      label={`${getConfidenceLabel(simulation.confidence)} (${Math.round(simulation.confidence * 100)}%)`}
                      size="small"
                      color={getConfidenceColor(simulation.confidence) as any}
                    />
                  </Box>

                  {/* Technical Specs Preview */}
                  <Paper sx={{ p: 1, mb: 2, bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
                    <Typography variant="caption" color="text.secondary">
                      <strong>Camera: </strong> {simulation.technicalSpecs.cameraAngle} | 
                      <strong> Lighting: </strong> {simulation.technicalSpecs.lighting} | 
                      <strong> Duration: </strong> {simulation.technicalSpecs.duration}s
                    </Typography>
                  </Paper>

                  {/* AI Generated Badge */}
                  {simulation.aiGenerated && (
                    <Chip 
                      icon={theming.getThemedIcon('smartToy')}}
                      label="AI Generated" 
                      size="small" 
                      color="success" 
                      variant="filled"
                      sx={{ mb:  1 }}
                    />
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      size="small"
                      startIcon={theming.getThemedIcon('visibility')}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSimulation(simulation);
                    }}
                    >
                      View Details
                    </Button>
                    <Button
                      size="small"
                      startIcon={theming.getThemedIcon('play')}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Play simulation preview
                    }}
                    >
                      Preview
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Simulation Details Dialog */}
      <Dialog 
        open={!!activeSimulation} 
        onClose={() => setActiveSimulation(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {activeSimulation?.title}
            </Typography>
            <IconButton onClick={() => setActiveSimulation(null)}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {activeSimulation && (
            <Stack spacing={3}>
              <Typography variant="body1">
                {activeSimulation.description}
              </Typography>

              {/* Technical Specifications */}
              <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Technical Specifications
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Camera Angle
                    </Typography>
                    <Typography variant="body1">
                      {activeSimulation.technicalSpecs.cameraAngle}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Lighting Setup
                    </Typography>
                    <Typography variant="body1">
                      {activeSimulation.technicalSpecs.lighting}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Movement
                    </Typography>
                    <Typography variant="body1">
                      {activeSimulation.technicalSpecs.movement}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography variant="body1">
                      {activeSimulation.technicalSpecs.duration} seconds
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Color Palette */}
              <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Color Palette
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                  {activeSimulation.technicalSpecs.colorPalette.map((color, index) => (
                    <Box
                      key={index}
                      sx={{
                        width:  40,
                        height:  40,
                        backgroundColor: color,
                        borderRadius:  1,
                        border: '1px solid #ccc'}}
                    />
                  ))}
                </Box>
              </Paper>

              {/* AI Recommendations */}
              <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  AI Recommendations
                </Typography>
                <ul>
                  {activeSimulation.recommendations.map((recommendation, index) => (
                    <li key={index}>
                      <Typography variant="body2">
                        {recommendation}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </Paper>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveSimulation(null)}>
            Close
          </Button>
          <Button variant="contained"
            onClick={() => {
              if (activeSimulation) {
                saveSimulation.mutate(activeSimulation);
                setActiveSimulation(null);
            }
          }}
          >
            Save Simulation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate All Simulations Dialog */}
      <Dialog 
        open={showSimulationDialog} 
        onClose={() => setShowSimulationDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Generate All Scene Simulations
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb:  2 }}>
            This will generate AI simulations for all {storyArcData?.scenes?.length || 0} scenes in your story arc.
            This process may take a few minutes.
          </Typography>
          <Alert severity="info">
            <Typography variant="body2">
              AI will analyze each scene and generate realistic simulations for: </Typography>
            <ul>
              <li>Lighting setups and mood</li>
              <li>Camera angles and movements</li>
              <li>Composition and framing</li>
              <li>Color palettes and aesthetics</li>
              <li>Technical recommendations</li>
            </ul>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSimulationDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained"
            onClick={() => {
              // Generate simulations for all scenes
              storyArcData?.scenes?.forEach((scene: any) => {
                handleGenerateSimulation(scene);
          });
              setShowSimulationDialog(false);
          }}
            disabled={isSimulating}
          >
            {isSimulating ? 'Generating...' : 'Generate All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
