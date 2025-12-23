/**
 * Shadow Analysis Panel
 * 
 * Enhanced with SAM 2 for shadow boundary detection
 * Analyzes shadow quality and distribution
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
  Slider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Opacity,
  AutoAwesome,
  CheckCircle,
  Warning,
  Visibility,
} from '@mui/icons-material';
import { shadowAnalysisService } from '../../core/services/shadowAnalysisService';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

interface ShadowAnalysisPanelProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: {
    shadowAreas: Array<{ bbox: [number, number, number, number]; quality: number }>;
    overallQuality: number;
    suggestions: string[];
  }) => void;
}

export function ShadowAnalysisPanel({
  imageUrl,
  onAnalysisComplete,
}: ShadowAnalysisPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [shadowAreas, setShadowAreas] = useState<Array<{ bbox: [number, number, number, number]; quality: number }>>([]);
  const [overallQuality, setOverallQuality] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [useSAM2, setUseSAM2] = useState(true);

  const analyzeShadows = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required ');
      }

      setIsAnalyzing(true);
      try {
        let detectedShadows: Array<{ bbox: [number, number, number, number]; quality: number }> = [];

        if (useSAM2) {
          // Use SAM 2 to detect shadow boundaries
          detectedShadows = await shadowAnalysisService.analyzeShadowsWithSAM2(imageUrl);
        } else {
          // Fallback to basic analysis
          const segmentation = await sam2Service.segmentImageFromUrl(
            imageUrl,
            undefined'auto', 'small'
          );
          detectedShadows = segmentation.masks.map(mask => ({
            bbox: mask.bbox,
            quality: 0.5, // Default quality
          }));
        }

        // Calculate overall quality
        const avgQuality = detectedShadows.length > 0
          ? detectedShadows.reduce((sum, area) => sum + area.quality, 0) / detectedShadows.length
          : 0.5;

        // Generate suggestions
        const analysisSuggestions: string[] = [];
        if (avgQuality < 0.4) {
          analysisSuggestions.push('Shadows are too harsh. Consider softening with a larger light source or diffuser');
        } else if (avgQuality > 0.8) {
          analysisSuggestions.push('Excellent shadow quality! Shadows are well-balanced and natural');
        }

        if (detectedShadows.length === 0) {
          analysisSuggestions.push('No significant shadows detected. Consider adding more directional lighting');
        }

        setShadowAreas(detectedShadows);
        setOverallQuality(Math.round(avgQuality * 100));
        setSuggestions(analysisSuggestions);

        onAnalysisComplete?.({
          shadowAreas: detectedShadows,
          overallQuality: Math.round(avgQuality * 100),
          suggestions: analysisSuggestions,
        });

        return { shadowAreas: detectedShadows, overallQuality: Math.round(avgQuality * 100) };
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error('Shadow analysis failed: ', error);
    },
  });

  const getQualityColor = (quality: number): string => {
    if (quality >= 80) return '#4CAF50';
    if (quality >= 60) return '#FFC107';
    return '#F44336';
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Opacity />
            Shadow Analysis
          </Typography>
          {overallQuality !== null && (
            <Chip
              label={`${overallQuality}% Quality`}
              size="small"
              sx={{
                bgcolor: getQualityColor(overallQuality),
                color: 'white'}}
            />
          )}
        </Box>

        {/* SAM 2 Toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={useSAM2}
              onChange={(e) => setUseSAM2(e.target.checked)}
            />
          }
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <AutoAwesome fontSize="small" />
              <Typography variant="body2">Use SAM 2 for Shadow Detection</Typography>
            </Stack>
          }
        />

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to analyze shadows
          </Alert>
        )}

        {imageUrl && (
          <>
            <Button
              variant="contained"
              startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoAwesome />}
              onClick={() => analyzeShadows.mutate()}
              disabled={isAnalyzing || !imageUrl}
              fullWidth
            >
              {isAnalyzing ? 'Analyzing Shadows...' : 'Analyze Shadow Quality'}
            </Button>

            {overallQuality !== null && (
              <>
                {/* Overall Quality */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Overall Shadow Quality
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          bgcolor: getQualityColor(overallQuality),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '1.2rem'}}
                      >
                        {overallQuality}
                      </Box>
                      <Box>
                        <Typography variant="h6">
                          {overallQuality >= 80 ? 'Excellent' : overallQuality >= 60 ? 'Good' : 'Needs Improvement'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {shadowAreas.length} shadow area(s) detected
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* Shadow Areas */}
                {shadowAreas.length > 0 && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Detected Shadow Areas
                      </Typography>
                      <Stack spacing={1}>
                        {shadowAreas.map((area, idx) => (
                          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">
                              Shadow Area {idx + 1}
                            </Typography>
                            <Chip
                              label={`${Math.round(area.quality * 100)}% quality`}
                              size="small"
                              color={area.quality > 0.7 ? 'success' : area.quality > 0.4 ? 'warning' : 'error'}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Suggestions
                    </Typography>
                    <Stack spacing={1}>
                      {suggestions.map((suggestion, idx) => (
                        <Alert
                          key={idx}
                          severity={overallQuality && overallQuality < 60 ? 'warning' : 'info'}
                          icon={overallQuality && overallQuality >= 80 ? <CheckCircle /> : <Warning />}
                        >
                          {suggestion}
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


























