/**
 * Auto Scene Optimizer
 * 
 * One-click scene optimization with AI suggestions
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
} from '@mui/material';
import {
  AutoAwesome,
  CameraAlt,
  Lightbulb,
  Person,
  Landscape,
  CheckCircle,
  ArrowForward,
} from '@mui/icons-material';
import { autoSceneOptimizerService, type SceneOptimization } from '../../core/services/autoSceneOptimizerService';
import { useMutation } from '@tanstack/react-query';

interface AutoSceneOptimizerProps {
  imageUrl?: string;
  onOptimizationComplete?: (optimization: SceneOptimization) => void;
  onApplyOptimization?: (optimization: SceneOptimization) => void;
}

export function AutoSceneOptimizer({
  imageUrl,
  onOptimizationComplete,
  onApplyOptimization,
}: AutoSceneOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<SceneOptimization | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  const optimizeScene = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required , ');
      }

      setIsOptimizing(true);
      try {
        const result = await autoSceneOptimizerService.optimizeScene(imageUrl);
        setOptimization(result);
        onOptimizationComplete?.(result);
        return result;
      } finally {
        setIsOptimizing(false);
      }
    },
    onError: (error: any) => {
      console.error('Scene optimization failed: ', error);
    },
  });

  const handleApply = () => {
    if (optimization) {
      // Filter optimization to only selected suggestions
      const filteredOptimization: SceneOptimization = {
        ...optimization,
        camera: selectedSuggestions.has('camera') ? optimization.camera : { ...optimization.camera, suggested: false },
        lights: optimization.lights.filter(l => selectedSuggestions.has(`light_${l.id}`)),
        subjects: optimization.subjects.filter(s => selectedSuggestions.has(`subject_${s.id}`)),
        background: selectedSuggestions.has('background') ? optimization.background : { ...optimization.background, suggested: false },
      };

      onApplyOptimization?.(filteredOptimization);
    }
  };

  const steps = [
    { label: 'Analyze Scene', icon: <AutoAwesome /> },
    { label: 'Review Suggestions', icon: <CheckCircle /> },
    { label: 'Apply Changes', icon: <ArrowForward /> },
  ];

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome />
            Auto Scene Optimizer
          </Typography>
          {optimization && (
            <Chip
              label={`+${optimization.expectedImprovement}% improvement`}
              size="small"
              color="success"
            />
          )}
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to optimize scene
          </Alert>
        )}

        {imageUrl && (
          <>
            <Stepper activeStep={activeStep} orientation="vertical">
              <Step>
                <StepLabel>Analyze Scene</StepLabel>
                <StepContent>
                  <Button
                    variant="contained"
                    startIcon={isOptimizing ? <CircularProgress size={16} /> : <AutoAwesome />}
                    onClick={() => {
                      optimizeScene.mutate();
                      setActiveStep(1);
                    }}
                    disabled={isOptimizing}
                    fullWidth
                  >
                    {isOptimizing ? 'Analyzing Scene...' : 'Start Optimization Analysis'}
                  </Button>
                </StepContent>
              </Step>

              {optimization && (
                <>
                  <Step>
                    <StepLabel>Review Suggestions</StepLabel>
                    <StepContent>
                      <Stack spacing={2}>
                        {/* Camera Suggestions */}
                        {optimization.camera.suggested && (
                          <Card variant="outlined">
                            <CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Checkbox
                                  checked={selectedSuggestions.has('camera')}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedSuggestions);
                                    if (e.target.checked) {
                                      newSet.add('camera');
                                    } else {
                                      newSet.delete('camera');
                                    }
                                    setSelectedSuggestions(newSet);
                                  }}
                                />
                                <CameraAlt />
                                <Typography variant="subtitle2">Camera Position</Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                Suggested position: ({optimization.camera.position.join(', ')})
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Expected improvement: Better composition alignment
                              </Typography>
                            </CardContent>
                          </Card>
                        )}

                        {/* Subject Suggestions */}
                        {optimization.subjects.filter(s => s.suggested).length > 0 && (
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="subtitle2" gutterBottom>
                                Subject Positioning
                              </Typography>
                              <List dense>
                                {optimization.subjects.filter(s => s.suggested).map((subject, idx) => (
                                  <ListItem key={idx}>
                                    <ListItemIcon>
                                      <Checkbox
                                        checked={selectedSuggestions.has(`subject_${subject.id}`)}
                                        onChange={(e) => {
                                          const newSet = new Set(selectedSuggestions);
                                          if (e.target.checked) {
                                            newSet.add(`subject_${subject.id}`);
                                          } else {
                                            newSet.delete(`subject_${subject.id}`);
                                          }
                                          setSelectedSuggestions(newSet);
                                        }}
                                      />
                                    </ListItemIcon>
                                    <ListItemText
                                      primary={`Subject ${idx + 1}`}
                                      secondary={`Move to: (${subject.position.join(', ')})`}
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            </CardContent>
                          </Card>
                        )}

                        {/* Background Suggestions */}
                        {optimization.background.suggested && (
                          <Card variant="outlined">
                            <CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Checkbox
                                  checked={selectedSuggestions.has('background')}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedSuggestions);
                                    if (e.target.checked) {
                                      newSet.add('background');
                                    } else {
                                      newSet.delete('background');
                                    }
                                    setSelectedSuggestions(newSet);
                                  }}
                                />
                                <Landscape />
                                <Typography variant="subtitle2">Background</Typography>
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {optimization.background.adjustments.join('')}
                              </Typography>
                            </CardContent>
                          </Card>
                        )}

                        <Button
                          variant="contained"
                          onClick={() => setActiveStep(2)}
                          disabled={selectedSuggestions.size === 0}
                          fullWidth
                        >
                          Continue to Apply
                        </Button>
                      </Stack>
                    </StepContent>
                  </Step>

                  <Step>
                    <StepLabel>Apply Changes</StepLabel>
                    <StepContent>
                      <Stack spacing={2}>
                        <Alert severity="info">
                          Ready to apply {selectedSuggestions.size} optimization(s)
                        </Alert>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            Expected Improvement: +{optimization.expectedImprovement}% composition score
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Current Score: {optimization.overallScore}% → Expected: {optimization.overallScore + optimization.expectedImprovement}%
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          onClick={handleApply}
                          fullWidth
                          startIcon={<CheckCircle />}
                        >
                          Apply Optimizations
                        </Button>
                      </Stack>
                    </StepContent>
                  </Step>
                </>
              )}
            </Stepper>
          </>
        )}
      </Stack>
    </Paper>
  );
}


























