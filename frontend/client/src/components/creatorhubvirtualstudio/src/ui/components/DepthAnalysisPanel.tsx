/**
 * Depth Analysis Panel
 * 
 * Analyzes depth maps from 3D scene and provides focus suggestions
 * Uses SAM 2 to identify subjects for depth of field optimization
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Slider,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Chip,
} from '@mui/material';
import {
  BlurOn,
  CenterFocusStrong,
  AutoAwesome,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

interface DepthZone {
  distance: number; // Distance from camera
  area: number; // Area in pixels
  objects: Array<{ bbox: [number, number, number, number]; center: [number, number] }>;
}

interface DepthAnalysis {
  zones: DepthZone[];
  recommendedFocus: number; // Recommended focus distance
  depthOfFieldRange: [number, number]; // Min and max distances in focus
  suggestions: Array<{
    type: 'focus' | 'aperture' | 'distance';
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

interface DepthAnalysisPanelProps {
  imageUrl?: string;
  depthMap?: number[][]; // Optional depth map data
  onAnalysisComplete?: (analysis: DepthAnalysis) => void;
  onFocusSuggestion?: (focusDistance: number) => void;
}

export function DepthAnalysisPanel({
  imageUrl,
  depthMap,
  onAnalysisComplete,
  onFocusSuggestion,
}: DepthAnalysisPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DepthAnalysis | null>(null);
  const [showDepthVisualization, setShowDepthVisualization] = useState(true);
  const [focalLength, setFocalLength] = useState(50); // mm
  const [aperture, setAperture] = useState(2.8); // f-stop
  const [focusDistance, setFocusDistance] = useState(2.0); // meters

  const analyzeDepth = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required');
      }

      setIsAnalyzing(true);
      try {
        // Detect objects in the scene using SAM 2
        const segmentation = await sam2Service.segmentImageFromUrl(
          imageUrl,
          undefined'auto', 'small');

        // Analyze depth zones (simplified - would use actual depth map if available)
        const zones = analyzeDepthZones(segmentation, depthMap);

        // Calculate recommended focus
        const recommendedFocus = calculateRecommendedFocus(zones, focalLength, aperture);

        // Calculate depth of field range
        const depthOfFieldRange = calculateDepthOfField(
          recommendedFocus,
          focalLength,
          aperture
        );

        // Generate suggestions
        const suggestions = generateDepthSuggestions(
          zones,
          recommendedFocus,
          depthOfFieldRange,
          focalLength,
          aperture
        );

        const analysisResult: DepthAnalysis = {
          zones,
          recommendedFocus,
          depthOfFieldRange,
          suggestions,
        };

        setAnalysis(analysisResult);
        onAnalysisComplete?.(analysisResult);
        onFocusSuggestion?.(recommendedFocus);

        return analysisResult;
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error('Depth analysis failed: ', error);
    },
  });

  const analyzeDepthZones = (
    segmentation: any,
    depthMap?: number[][]
  ): DepthZone[] => {
    // Simplified depth zone analysis
    // In production, would use actual depth map from 3D scene
    const zones: DepthZone[] = [];

    if (segmentation.masks && segmentation.masks.length > 0) {
      segmentation.masks.forEach((mask: any, idx: number) => {
        // Estimate depth based on object size and position
        // Larger objects closer to center are typically closer
        const [x, y, w, h] = mask.bbox;
        const area = w * h;
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        const [width, height] = segmentation.image_size;

        // Simplified depth estimation
        const distanceFromCenter = Math.sqrt(
          Math.pow(centerX - width / 2, 2) + Math.pow(centerY - height / 2, 2)
        );
        const normalizedDistance = distanceFromCenter / Math.sqrt(width * width + height * height);

        // Estimate depth (closer objects are larger and more centered)
        const estimatedDepth = 1.0 + normalizedDistance * 3.0; // 1-4 meters range

        zones.push({
          distance: estimatedDepth,
          area,
          objects: [{
            bbox: mask.bbox,
            center: mask.center,
          }],
        });
      });
    }

    // Sort by distance
    zones.sort((a, b) => a.distance - b.distance);

    return zones;
  };

  const calculateRecommendedFocus = (
    zones: DepthZone[],
    focalLength: number,
    aperture: number
  ): number => {
    if (zones.length === 0) return 2.0;

    // Focus on the zone with the largest area (main subject)
    const mainZone = zones.reduce((prev, current) =>
      current.area > prev.area ? current : prev
    );

    return mainZone.distance;
  };

  const calculateDepthOfField = (
    focusDistance: number,
    focalLength: number,
    aperture: number
  ): [number, number] => {
    // Simplified depth of field calculation
    // Hyperfocal distance approximation
    const hyperfocal = (focalLength * focalLength) / (aperture * 0.000029); // Circle of confusion

    const nearLimit = (hyperfocal * focusDistance) / (hyperfocal + focusDistance);
    const farLimit = (hyperfocal * focusDistance) / (hyperfocal - focusDistance);

    return [nearLimit, farLimit];
  };

  const generateDepthSuggestions = (
    zones: DepthZone[],
    recommendedFocus: number,
    depthOfFieldRange: [number, number],
    focalLength: number,
    aperture: number
  ): DepthAnalysis['suggestions'] => {
    const suggestions: DepthAnalysis['suggestions'] = [];

    // Check if all subjects are in focus
    const subjectsInFocus = zones.filter(
      zone => zone.distance >= depthOfFieldRange[0] && zone.distance <= depthOfFieldRange[1]
    );

    if (subjectsInFocus.length < zones.length) {
      suggestions.push({
        type: 'focus',
        message: `${zones.length - subjectsInFocus.length} subject(s) are out of focus. Consider adjusting focus distance or aperture`,
        priority: 'high',
      });
    }

    // Aperture suggestions
    if (zones.length > 1) {
      const depthRange = Math.max(...zones.map(z => z.distance)) - Math.min(...zones.map(z => z.distance));
      if (depthRange > 2.0 && aperture < 5.6) {
        suggestions.push({
          type: 'aperture',
          message: 'Multiple subjects at different distances. Consider stopping down aperture for greater depth of field',
          priority: 'medium',
        });
      }
    }

    // Focus distance suggestions
    if (Math.abs(focusDistance - recommendedFocus) > 0.5) {
      suggestions.push({
        type: 'distance',
        message: `Recommended focus, distance: ${recommendedFocus.toFixed(2)}m (current: ${focusDistance.toFixed(2)}m)`,
        priority: 'medium',
      });
    }

    return suggestions;
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BlurOn />
            Depth Analysis
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showDepthVisualization}
                onChange={(e) => setShowDepthVisualization(e.target.checked)}
              />
            }
            label="Show Visualization"
          />
        </Box>

        {/* Camera Settings */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Camera Settings
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Focal Length: {focalLength}mm
                </Typography>
                <Slider
                  value={focalLength}
                  onChange={(_, v) => setFocalLength(v as number)}
                  min={24}
                  max={200}
                  step={1}
                />
              </Box>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Aperture: f/{aperture}
                </Typography>
                <Slider
                  value={aperture}
                  onChange={(_, v) => setAperture(v as number)}
                  min={1.4}
                  max={16}
                  step={0.1}
                />
              </Box>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Focus Distance: {focusDistance.toFixed(2)}m
                </Typography>
                <Slider
                  value={focusDistance}
                  onChange={(_, v) => {
                    setFocusDistance(v as number);
                    onFocusSuggestion?.(v as number);
                  }}
                  min={0.5}
                  max={10}
                  step={0.1}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to analyze depth
          </Alert>
        )}

        {imageUrl && (
          <>
            <Button
              variant="contained"
              startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoAwesome />}
              onClick={() => analyzeDepth.mutate()}
              disabled={isAnalyzing || !imageUrl}
              fullWidth
            >
              {isAnalyzing ? 'Analyzing Depth...' : 'Analyze Depth'}
            </Button>

            {analysis && (
              <>
                {/* Depth Zones */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Depth Zones
                    </Typography>
                    <Stack spacing={1}>
                      {analysis.zones.map((zone, idx) => (
                        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">
                            Zone {idx + 1}: {zone.distance.toFixed(2)}m
                          </Typography>
                          <Chip
                            label={`${zone.objects.length} object(s)`}
                            size="small"
                            color={zone.distance >= analysis.depthOfFieldRange[0] && zone.distance <= analysis.depthOfFieldRange[1] ? 'success' : 'default'}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Depth of Field Range */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Depth of Field Range
                    </Typography>
                    <Typography variant="body2">
                      Near Limit: {analysis.depthOfFieldRange[0].toFixed(2)}m
                    </Typography>
                    <Typography variant="body2">
                      Far Limit: {analysis.depthOfFieldRange[1].toFixed(2)}m
                    </Typography>
                    <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                      Recommended Focus: {analysis.recommendedFocus.toFixed(2)}m
                    </Typography>
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


























