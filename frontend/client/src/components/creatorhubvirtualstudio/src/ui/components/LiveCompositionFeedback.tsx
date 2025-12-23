/**
 * Live Composition Feedback
 * 
 * Real-time composition analysis as user adjusts camera/objects
 * Visual indicators for rule of thirds, symmetry, balance
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  GridOn,
  AutoAwesome,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { sceneCompositionService } from '../../core/services/sceneCompositionService';
import { useMutation } from '@tanstack/react-query';

interface LiveCompositionFeedbackProps {
  imageUrl?: string;
  enabled?: boolean;
  onScoreUpdate?: (score: number) => void;
  onSuggestionUpdate?: (suggestions: Array<{ message: string; priority: string }>) => void;
}

export function LiveCompositionFeedback({
  imageUrl,
  enabled = true,
  onScoreUpdate,
  onSuggestionUpdate,
}: LiveCompositionFeedbackProps) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<Array<{ message: string; priority: string }>>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeComposition = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required');
      }

      setIsAnalyzing(true);
      try {
        const analysis = await sceneCompositionService.analyzeComposition(imageUrl);
        
        setCurrentScore(analysis.score.overall);
        setCurrentSuggestions(analysis.suggestions.map(s => ({
          message: s.message,
          priority: s.priority,
        })));

        onScoreUpdate?.(analysis.score.overall);
        onSuggestionUpdate?.(analysis.suggestions.map(s => ({
          message: s.message,
          priority: s.priority,
        })));

        return analysis;
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error('Live composition analysis failed: ', error);
    },
  });

  // Auto-analyze when image changes (if enabled)
  useEffect(() => {
    if (isEnabled && imageUrl && !isAnalyzing) {
      const timer = setTimeout(() => {
        analyzeComposition.mutate();
      }, 1000); // Debounce for real-time updates

      return () => clearTimeout(timer);
    }
  }, [imageUrl, isEnabled]);

  const getScoreColor = (score: number | null): string => {
    if (score === null) return '#9E9E9E';
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    return '#F44336';
  };

  const getScoreLabel = (score: number | null): string => {
    if (score === null) return 'Not Analyzed';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <Paper
      sx={{
        position: 'fixed',
        top: 80,
        right: 20,
        width: 300,
        zIndex: 100,
        p: 2,
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)'}}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '1rem' }}>
            <GridOn />
            Live Composition
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                size="small"
              />
            }
            label=""
          />
        </Box>

        {!imageUrl && (
          <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
            Capture scene to see live feedback
          </Alert>
        )}

        {imageUrl && isEnabled && (
          <>
            {isAnalyzing && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <CircularProgress size={20} />
              </Box>
            )}

            {currentScore !== null && !isAnalyzing && (
              <>
                {/* Score Display */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: '50%',
                      bgcolor: getScoreColor(currentScore),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1rem'}}
                  >
                    {currentScore}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {getScoreLabel(currentScore)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Composition Score
                    </Typography>
                  </Box>
                </Box>

                {/* Quick Suggestions */}
                {currentSuggestions.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={600} gutterBottom sx={{ display: 'block' }}>
                      Quick Tips:
                    </Typography>
                    <Stack spacing={0.5}>
                      {currentSuggestions.slice(0, 2).map((suggestion, idx) => (
                        <Alert
                          key={idx}
                          severity={suggestion.priority === 'high' ? 'warning' : 'info'}
                          icon={suggestion.priority === 'high' ? <Warning fontSize="small" /> : <Info fontSize="small" />}
                          sx={{ py: 0.5, fontSize:'0.7rem' }}
                        >
                          <Typography variant="caption">{suggestion.message}</Typography>
                        </Alert>
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}


























