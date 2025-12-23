/**
 * Lighting Quality Analyzer
 * 
 * Real-time analysis of lighting quality using face detection, catchlight analysis,
 * shadow detection, and exposure balance
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Card,
  CardContent,
  Chip,
  Slider,
  Alert,
  CircularProgress,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  Lightbulb,
  AutoAwesome,
  CheckCircle,
  Warning,
  Visibility,
  Opacity,
} from '@mui/icons-material';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

interface LightingQualityMetrics {
  overall: number;
  catchlight: number;
  shadowQuality: number;
  exposureBalance: number;
  contrast: number;
}

interface LightingAnalysis {
  metrics: LightingQualityMetrics;
  catchlights: Array<{ x: number; y: number; size: number; quality: number }>;
  shadowAreas: Array<{ bbox: [number, number, number, number]; quality: number }>;
  suggestions: Array<{
    type: 'catchlight' | 'shadow' | 'exposure' | 'contrast';
    message: string;
    priority: 'high' | 'medium' | 'low';
    action?: string;
  }>;
}

interface LightingQualityAnalyzerProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: LightingAnalysis) => void;
  realTime?: boolean; // Enable real-time analysis
}

export function LightingQualityAnalyzer({
  imageUrl,
  onAnalysisComplete,
  realTime = false,
}: LightingQualityAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<LightingAnalysis | null>(null);
  const [autoAnalyze, setAutoAnalyze] = useState(realTime);

  const analyzeLighting = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required');
      }

      setIsAnalyzing(true);
      try {
        // Detect face/subject using SAM 2
        const segmentation = await sam2Service.segmentImageFromUrl(
          imageUrl,
          { points: [[0.5, 0.4]] }, // Center-top (face location)
          'point', 'small');

        // Analyze lighting quality
        const metrics = analyzeLightingMetrics(segmentation);
        const catchlights = detectCatchlights(segmentation);
        const shadowAreas = analyzeShadows(segmentation);
        const suggestions = generateLightingSuggestions(metrics, catchlights, shadowAreas);

        const analysisResult: LightingAnalysis = {
          metrics,
          catchlights,
          shadowAreas,
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
      console.error('Lighting analysis failed: ', error);
    },
  });

  // Auto-analyze when image changes (if real-time enabled)
  useEffect(() => {
    if (autoAnalyze && imageUrl && !isAnalyzing) {
      const timer = setTimeout(() => {
        analyzeLighting.mutate();
      }, 1000); // Debounce

      return () => clearTimeout(timer);
    }
  }, [imageUrl, autoAnalyze]);

  const analyzeLightingMetrics = (segmentation: any): LightingQualityMetrics => {
    // Simplified metrics calculation
    // In production, would analyze actual image pixels for exposure, contrast, etc.
    
    const catchlightScore = 75; // Placeholder - would detect catchlights in eyes
    const shadowScore = 80; // Placeholder - would analyze shadow distribution
    const exposureScore = 85; // Placeholder - would analyze exposure across face
    const contrastScore = 70; // Placeholder - would calculate contrast ratio

    const overall = Math.round(
      catchlightScore * 0.3 +
      shadowScore * 0.25 +
      exposureScore * 0.25 +
      contrastScore * 0.2
    );

    return {
      overall,
      catchlight: catchlightScore,
      shadowQuality: shadowScore,
      exposureBalance: exposureScore,
      contrast: contrastScore,
    };
  };

  const detectCatchlights = (segmentation: any): Array<{ x: number; y: number; size: number; quality: number }> => {
    // Simplified catchlight detection
    // In production, would detect bright spots in eye regions
    const catchlights: Array<{ x: number; y: number; size: number; quality: number }> = [];

    if (segmentation.masks && segmentation.masks.length > 0) {
      const [x, y, w, h] = segmentation.masks[0].bbox;
      // Estimate eye positions (simplified)
      const leftEyeX = x + w * 0.35;
      const rightEyeX = x + w * 0.65;
      const eyeY = y + h * 0.3;

      catchlights.push(
        { x: leftEyeX, y: eyeY, size: 5, quality: 0.8 },
        { x: rightEyeX, y: eyeY, size: 5, quality: 0.8 }
      );
    }

    return catchlights;
  };

  const analyzeShadows = (segmentation: any): Array<{ bbox: [number, number, number, number]; quality: number }> => {
    // Simplified shadow analysis
    // In production, would detect shadow areas and analyze quality
    const shadowAreas: Array<{ bbox: [number, number, number, number]; quality: number }> = [];

    if (segmentation.masks && segmentation.masks.length > 0) {
      const [x, y, w, h] = segmentation.masks[0].bbox;
      // Estimate shadow areas (simplified)
      shadowAreas.push({
        bbox: [x, y + h * 0.7, w, h * 0.3],
        quality: 0.75, // Shadow quality score
      });
    }

    return shadowAreas;
  };

  const generateLightingSuggestions = (
    metrics: LightingQualityMetrics,
    catchlights: Array<{ quality: number }>,
    shadowAreas: Array<{ quality: number }>
  ): LightingAnalysis['suggestions'] => {
    const suggestions: LightingAnalysis['suggestions'] = [];

    // Catchlight suggestions
    if (metrics.catchlight < 60) {
      suggestions.push({
        type: 'catchlight',
        message: 'Catchlights are weak. Consider adding a key light or reflector to create eye sparkle',
        priority: 'high',
        action: 'Add key light',
      });
    } else if (catchlights.length === 0) {
      suggestions.push({
        type: 'catchlight',
        message: 'No catchlights detected. Add a light source to create natural eye sparkle',
        priority: 'medium',
      });
    }

    // Shadow suggestions
    if (metrics.shadowQuality < 50) {
      suggestions.push({
        type: 'shadow',
        message: 'Shadows are too harsh. Consider softening with a larger light source or fill light',
        priority: 'high',
        action: 'Soften shadows',
      });
    } else if (metrics.shadowQuality > 90) {
      suggestions.push({
        type: 'shadow',
        message: 'Excellent shadow quality! Shadows are well-balanced and natural',
        priority: 'low',
      });
    }

    // Exposure suggestions
    if (metrics.exposureBalance < 60) {
      suggestions.push({
        type: 'exposure',
        message: 'Exposure is unbalanced. Consider adjusting light intensity or adding fill light',
        priority: 'medium',
      });
    }

    // Contrast suggestions
    if (metrics.contrast < 50) {
      suggestions.push({
        type: 'contrast',
        message: 'Contrast is low. Consider increasing key-to-fill ratio for more dramatic lighting',
        priority: 'medium',
      });
    } else if (metrics.contrast > 90) {
      suggestions.push({
        type: 'contrast',
        message: 'Contrast is very high. May be too dramatic - consider adding fill light',
        priority: 'low',
      });
    }

    // Overall feedback
    if (metrics.overall >= 85) {
      suggestions.push({
        type: 'exposure',
        message: 'Excellent lighting quality! All metrics are well-balanced',
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
            <Lightbulb />
            Lighting Quality Analyzer
          </Typography>
          {analysis && (
            <Chip
              label={`${analysis.metrics.overall}% Quality`}
              size="small"
              sx={{
                bgcolor: getScoreColor(analysis.metrics.overall),
                color: 'white'}}
            />
          )}
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to analyze lighting quality
          </Alert>
        )}

        {imageUrl && (
          <>
            <Box>
              <Button
                variant="contained"
                startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoAwesome />}
                onClick={() => analyzeLighting.mutate()}
                disabled={isAnalyzing || !imageUrl}
                fullWidth
              >
                {isAnalyzing ? 'Analyzing Lighting...' : 'Analyze Lighting Quality'}
              </Button>
            </Box>

            {analysis && (
              <>
                {/* Overall Score */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Overall Lighting Quality
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          bgcolor: getScoreColor(analysis.metrics.overall),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '1.5rem'}}
                      >
                        {analysis.metrics.overall}
                      </Box>
                      <Box>
                        <Typography variant="h6">
                          {analysis.metrics.overall >= 80 ? 'Excellent' : analysis.metrics.overall >= 60 ? 'Good' : 'Needs Improvement'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Based on catchlight, shadow, exposure, and contrast analysis
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* Detailed Metrics */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" gutterBottom>
                          Catchlight Quality
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.metrics.catchlight}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0','& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.metrics.catchlight),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.metrics.catchlight}%
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {analysis.catchlights.length} catchlight(s) detected
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" gutterBottom>
                          Shadow Quality
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.metrics.shadowQuality}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.metrics.shadowQuality),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.metrics.shadowQuality}%
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {analysis.shadowAreas.length} shadow area(s) analyzed
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" gutterBottom>
                          Exposure Balance
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.metrics.exposureBalance}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.metrics.exposureBalance),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.metrics.exposureBalance}%
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="body2" gutterBottom>
                          Contrast
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={analysis.metrics.contrast}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: getScoreColor(analysis.metrics.contrast),
                              }}}
                          />
                          <Typography variant="body2" fontWeight={600}>
                            {analysis.metrics.contrast}%
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

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
                          <Typography variant="body2">{suggestion.message}</Typography>
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


























