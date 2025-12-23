/**
 * Background Analyzer
 * 
 * Uses SAM 2 to analyze background elements and detect distracting elements
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
} from '@mui/material';
import {
  Landscape,
  AutoAwesome,
  CheckCircle,
  Warning,
  Delete,
  BlurOn,
  SwapHoriz,
} from '@mui/icons-material';
import { backgroundAnalysisService } from '../../core/services/backgroundAnalysisService';
import { useMutation } from '@tanstack/react-query';

interface BackgroundAnalyzerProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: {
    distractingElements: number;
    quality: number;
    suggestions: string[];
  }) => void;
}

export function BackgroundAnalyzer({
  imageUrl,
  onAnalysisComplete,
}: BackgroundAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const analyzeBackground = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required');
      }

      setIsAnalyzing(true);
      try {
        const result = await backgroundAnalysisService.analyzeBackground(imageUrl);
        setAnalysis(result);
        onAnalysisComplete?.({
          distractingElements: result.distractingElements.length,
          quality: result.backgroundQuality,
          suggestions: result.suggestions.map(s => s.message),
        });
        return result;
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error('Background analysis failed: ', error);
    },
  });

  const getQualityColor = (quality: number): string => {
    if (quality >= 80) return '#4CAF50';
    if (quality >= 60) return '#FFC107';
    return '#F44336';
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'remove':
        return <Delete />;
      case 'blur':
        return <BlurOn />;
      case 'replace':
        return <SwapHoriz />;
      default:
        return <CheckCircle />;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Landscape />
            Background Analyzer
          </Typography>
          {analysis && (
            <Chip
              label={`${analysis.backgroundQuality}% Quality`}
              size="small"
              sx={{
                bgcolor: getQualityColor(analysis.backgroundQuality),
                color: 'white'}}
            />
          )}
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to analyze background
          </Alert>
        )}

        {imageUrl && (
          <>
            <Button
              variant="contained"
              startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoAwesome />}
              onClick={() => analyzeBackground.mutate()}
              disabled={isAnalyzing || !imageUrl}
              fullWidth
            >
              {isAnalyzing ? 'Analyzing Background...' : 'Analyze Background'}
            </Button>

            {analysis && (
              <>
                {/* Quality Score */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Background Quality
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          borderRadius: '50%',
                          bgcolor: getQualityColor(analysis.backgroundQuality),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '1.2rem'}}
                      >
                        {analysis.backgroundQuality}
                      </Box>
                      <Box>
                        <Typography variant="h6">
                          {analysis.backgroundQuality >= 80 ? 'Excellent' : analysis.backgroundQuality >= 60 ? 'Good' : 'Needs Improvement'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {analysis.distractingElements.length} distracting element(s) detected
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* Distracting Elements */}
                {analysis.distractingElements.length > 0 && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Distracting Elements
                      </Typography>
                      <Stack spacing={1}>
                        {analysis.distractingElements.map((elem: any, idx: number) => (
                          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">
                              Element {idx + 1} at ({elem.center[0].toFixed(0)}, {elem.center[1].toFixed(0)})
                            </Typography>
                            <Chip
                              label={`${(elem.confidence * 100).toFixed(0)}% confidence`}
                              size="small"
                            />
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {/* Suggestions */}
                {analysis.suggestions.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Suggestions
                    </Typography>
                    <Stack spacing={1}>
                      {analysis.suggestions.map((suggestion: any, idx: number) => (
                        <Alert
                          key={idx}
                          severity={suggestion.priority === 'high' ? 'warning' : 'info'}
                          icon={getSuggestionIcon(suggestion.type)}
                        >
                          {suggestion.message}
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


























