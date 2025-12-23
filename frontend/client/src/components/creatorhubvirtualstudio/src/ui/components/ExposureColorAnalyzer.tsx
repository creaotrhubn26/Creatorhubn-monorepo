/**
 * Exposure & Color Analyzer
 * 
 * Real-time exposure analysis using subject detection
 * Color harmony analysis and skin tone optimization
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  LinearProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  WbSunny,
  Palette,
  AutoAwesome,
  CheckCircle,
  Warning,
  TrendingUp,
} from '@mui/icons-material';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

interface ExposureMetrics {
  overall: number;
  subjectExposure: number;
  backgroundExposure: number;
  highlightClipping: number;
  shadowClipping: number;
}

interface ColorMetrics {
  harmony: number;
  skinTone: number;
  saturation: number;
  temperature: number;
}

interface ExposureColorAnalysis {
  exposure: ExposureMetrics;
  color: ColorMetrics;
  suggestions: Array<{
    type: 'exposure' | 'color' | 'skin-tone';
    message: string;
    priority: 'high' | 'medium' | 'low';
    action?: string;
  }>;
}

interface ExposureColorAnalyzerProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: ExposureColorAnalysis) => void;
  realTime?: boolean;
}

export function ExposureColorAnalyzer({
  imageUrl,
  onAnalysisComplete,
  realTime = false,
}: ExposureColorAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ExposureColorAnalysis | null>(null);
  const [autoAnalyze, setAutoAnalyze] = useState(realTime);

  const analyzeExposureColor = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required');
      }

      setIsAnalyzing(true);
      try {
        // Detect subject using SAM 2
        const segmentation = await sam2Service.segmentImageFromUrl(
          imageUrl,
          { points: [[0.5, 0.4]] }, // Center-top (subject location)
          'point', 'small');

        // Analyze exposure and color
        const exposure = analyzeExposure(segmentation);
        const color = analyzeColor(segmentation);
        const suggestions = generateSuggestions(exposure, color);

        const analysisResult: ExposureColorAnalysis = {
          exposure,
          color,
          suggestions,
        };

        setAnalysis(analysisResult);
        onAnalysisComplete?.(analysisResult);

        return analysisResult;
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error('Exposure/color analysis failed: ', error);
    },
  });

  // Auto-analyze when image changes (if real-time enabled)
  useEffect(() => {
    if (autoAnalyze && imageUrl && !isAnalyzing) {
      const timer = setTimeout(() => {
        analyzeExposureColor.mutate();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [imageUrl, autoAnalyze]);

  const analyzeExposure = (segmentation: any): ExposureMetrics => {
    // Simplified exposure analysis
    // In production, would analyze actual pixel values
    
    const subjectExposure = 85; // Placeholder
    const backgroundExposure = 75;
    const highlightClipping = 5; // Percentage of clipped highlights
    const shadowClipping = 3; // Percentage of clipped shadows

    const overall = Math.round(
      subjectExposure * 0.4 +
      backgroundExposure * 0.3 +
      (100 - highlightClipping * 2) * 0.15 +
      (100 - shadowClipping * 2) * 0.15
    );

    return {
      overall,
      subjectExposure,
      backgroundExposure,
      highlightClipping,
      shadowClipping,
    };
  };

  const analyzeColor = (segmentation: any): ColorMetrics => {
    // Simplified color analysis
    // In production, would analyze color distribution, skin tones, etc.
    
    return {
      harmony: 80,
      skinTone: 75,
      saturation: 70,
      temperature: 5500, // Kelvin
    };
  };

  const generateSuggestions = (
    exposure: ExposureMetrics,
    color: ColorMetrics
  ): ExposureColorAnalysis['suggestions'] => {
    const suggestions: ExposureColorAnalysis['suggestions'] = [];

    // Exposure suggestions
    if (exposure.subjectExposure < 60) {
      suggestions.push({
        type: 'exposure',
        message: 'Subject is underexposed. Increase key light intensity or add fill light',
        priority: 'high',
        action: 'Increase exposure',
      });
    } else if (exposure.subjectExposure > 95) {
      suggestions.push({
        type: 'exposure',
        message: 'Subject is overexposed. Reduce key light intensity',
        priority: 'high',
        action: 'Reduce exposure',
      });
    }

    if (exposure.highlightClipping > 5) {
      suggestions.push({
        type: 'exposure',
        message: `${exposure.highlightClipping}% of highlights are clipped. Reduce light intensity`,
        priority: 'medium',
      });
    }

    // Color suggestions
    if (color.harmony < 60) {
      suggestions.push({
        type: 'color',
        message: 'Color harmony could be improved. Consider adjusting color temperature or adding color gels',
        priority: 'medium',
      });
    }

    if (color.skinTone < 60) {
      suggestions.push({
        type: 'skin-tone',
        message: 'Skin tone appears unnatural. Adjust color temperature or add warming filter',
        priority: 'high',
        action: 'Adjust skin tone',
      });
    }

    // Overall feedback
    if (exposure.overall >= 85 && color.harmony >= 80) {
      suggestions.push({
        type: 'exposure',
        message: 'Excellent exposure and color balance!',
        priority: 'low',
      });
    }

    return suggestions;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    return '#F44336';
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WbSunny />
            Exposure & Color Analysis
          </Typography>
          {analysis && (
            <Chip
              label={`${analysis.exposure.overall}% Overall`}
              size="small"
              sx={{
                bgcolor: getScoreColor(analysis.exposure.overall),
                color: 'white'}}
            />
          )}
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to analyze exposure and color
          </Alert>
        )}

        {imageUrl && (
          <>
            <Box>
              <Button
                variant="contained"
                startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoAwesome />}
                onClick={() => analyzeExposureColor.mutate()}
                disabled={isAnalyzing || !imageUrl}
                fullWidth
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Exposure & Color'}
              </Button>
            </Box>

            {analysis && (
              <>
                {/* Exposure Metrics */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Exposure Metrics
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Subject Exposure
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.exposure.subjectExposure}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0','& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.exposure.subjectExposure),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.exposure.subjectExposure}%
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Background Exposure
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.exposure.backgroundExposure}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.exposure.backgroundExposure),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.exposure.backgroundExposure}%
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Highlight Clipping
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {analysis.exposure.highlightClipping}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Shadow Clipping
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {analysis.exposure.shadowClipping}%
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Color Metrics */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Color Metrics
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Color Harmony
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.color.harmony}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.color.harmony),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.color.harmony}%
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Skin Tone
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.color.skinTone}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.color.skinTone),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.color.skinTone}%
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Color Temperature
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {analysis.color.temperature}K
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Saturation
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {analysis.color.saturation}%
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Suggestions */}
                {analysis.suggestions.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Suggestions
                    </Typography>
                    <Stack spacing={1}>
                      {analysis.suggestions.map((suggestion, idx) => (
                        <Alert
                          key={idx}
                          severity={suggestion.priority === 'high' ? 'warning' : 'info'}
                          icon={suggestion.priority ==='high' ? <Warning /> : <CheckCircle />}
                        >
                          {suggestion.message}
                          {suggestion.action && (
                            <Button size="small" sx={{ mt: 1 }}>
                              {suggestion.action}
                            </Button>
                          )}
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


























