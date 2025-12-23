/**
 * AI Shot Suggestions
 * 
 * Analyzes current setup and suggests alternative camera angles,
 * lighting setups, and composition variations
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
  Grid,
  CardMedia,
} from '@mui/material';
import {
  CameraAlt,
  Lightbulb,
  GridOn,
  AutoAwesome,
  CheckCircle,
  TrendingUp,
} from '@mui/icons-material';
import { aiShotSuggestionService, type ShotSuggestion } from '../../core/services/aiShotSuggestionService';
import { useMutation } from '@tanstack/react-query';

interface AIShotSuggestionsProps {
  imageUrl?: string;
  onSuggestionSelect?: (suggestion: ShotSuggestion) => void;
  onApplySuggestion?: (suggestion: ShotSuggestion) => void;
}

export function AIShotSuggestions({
  imageUrl,
  onSuggestionSelect,
  onApplySuggestion,
}: AIShotSuggestionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<ShotSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ShotSuggestion | null>(null);

  const generateSuggestions = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required ');
      }

      setIsGenerating(true);
      try {
        const result = await aiShotSuggestionService.generateSuggestions(imageUrl);
        setSuggestions(result);
        return result;
      } finally {
        setIsGenerating(false);
      }
    },
    onError: (error: any) => {
      console.error('Shot suggestion generation failed: ', error);
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'angle':
        return <CameraAlt />;
      case 'lighting':
        return <Lightbulb />;
      case 'composition':
        return <GridOn />;
      default:
        return <AutoAwesome />;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'angle':
        return '#1976d2';
      case 'lighting':
        return '#F59E0B';
      case 'composition':
        return '#8B5CF6';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome />
            AI Shot Suggestions
          </Typography>
          {suggestions.length > 0 && (
            <Chip
              label={`${suggestions.length} suggestions`}
              size="small"
              color="primary"
            />
          )}
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to generate shot suggestions
          </Alert>
        )}

        {imageUrl && (
          <>
            <Button
              variant="contained"
              startIcon={isGenerating ? <CircularProgress size={16} /> : <AutoAwesome />}
              onClick={() => generateSuggestions.mutate()}
              disabled={isGenerating || !imageUrl}
              fullWidth
            >
              {isGenerating ? 'Generating Suggestions...' : 'Generate Shot Suggestions'}
            </Button>

            {suggestions.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Alternative Shots
                </Typography>
                <Grid container spacing={2}>
                  {suggestions.map((suggestion) => (
                    <Grid item xs={12} sm={6} key={suggestion.id}>
                      <Card
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          border: selectedSuggestion?.id === suggestion.id ? 2 : 1,
                          borderColor: selectedSuggestion?.id === suggestion.id ? 'primary.main' : 'divider',
                          height: '100%'}}
                        onClick={() => {
                          setSelectedSuggestion(suggestion);
                          onSuggestionSelect?.(suggestion);
                        }}
                      >
                        <CardContent>
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {suggestion.name}
                              </Typography>
                              <Chip
                                icon={getTypeIcon(suggestion.type)}
                                label={suggestion.type}
                                size="small"
                                sx={{
                                  bgcolor: getTypeColor(suggestion.type),
                                  color: 'white'}}
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {suggestion.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <TrendingUp fontSize="small" />
                              <Typography variant="caption">
                                Expected Score: {suggestion.expectedScore}%
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              fullWidth
                              onClick={(e) => {
                                e.stopPropagation();
                                onApplySuggestion?.(suggestion);
                              }}
                            >
                              Apply This Shot
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {/* Selected Suggestion Details */}
                {selectedSuggestion && (
                  <Card variant="outlined" sx={{ bgcolor: 'primary.light' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {selectedSuggestion.name} - Details
                      </Typography>
                      <Stack spacing={1}>
                        <Box>
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Camera Position:
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ({selectedSuggestion.cameraPosition.join(', ')})
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Camera Rotation:
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ({selectedSuggestion.cameraRotation.join(', ')})
                          </Typography>
                        </Box>
                        {selectedSuggestion.lightingAdjustments && selectedSuggestion.lightingAdjustments.length > 0 && (
                          <Box>
                            <Typography variant="body2" fontWeight={600} gutterBottom>
                              Lighting Adjustments:
                            </Typography>
                            {selectedSuggestion.lightingAdjustments.map((adj, idx) => (
                              <Typography key={idx} variant="body2" color="text.secondary">
                                {adj.lightId}: Position ({adj.position?.join('')}), Intensity: {adj.intensity}
                              </Typography>
                            ))}
                          </Box>
                        )}
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => onApplySuggestion?.(selectedSuggestion)}
                          startIcon={<CheckCircle />}
                        >
                          Apply This Shot
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}


























