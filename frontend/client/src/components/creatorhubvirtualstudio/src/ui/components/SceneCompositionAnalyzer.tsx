/**
 * Scene Composition Analyzer
 * 
 * Uses SAM 2 to detect objects/subjects in the scene and analyze composition
 * Provides real-time composition score and suggestions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Chip,
  Slider,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  AutoAwesome,
  GridOn,
  Straighten,
  Balance,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { sam2Service, type SAM2SegmentationResult } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface CompositionScore {
  overall: number;
  ruleOfThirds: number;
  symmetry: number;
  balance: number;
  leadingLines: number;
  subjectPlacement: number;
}

interface CompositionSuggestion {
  type: 'improvement' | 'tip' | 'warning';
  category: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  action?: string;
}

interface SceneCompositionAnalyzerProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: {
    score: CompositionScore;
    suggestions: CompositionSuggestion[];
    objects: Array<{ bbox: [number, number, number, number]; center: [number, number]; confidence: number }>;
  }) => void;
  showOverlay?: boolean;
  onOverlayToggle?: (enabled: boolean) => void;
}

export function SceneCompositionAnalyzer({
  imageUrl,
  onAnalysisComplete,
  showOverlay = true,
  onOverlayToggle,
}: SceneCompositionAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [compositionScore, setCompositionScore] = useState<CompositionScore | null>(null);
  const [suggestions, setSuggestions] = useState<CompositionSuggestion[]>([]);
  const [detectedObjects, setDetectedObjects] = useState<Array<{ bbox: [number, number, number, number]; center: [number, number]; confidence: number }>>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [sensitivity, setSensitivity] = useState(70);

  const analyzeComposition = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required ');
      }

      setIsAnalyzing(true);
      try {
        // Use SAM 2 to detect all objects in the scene
        const segmentation = await sam2Service.segmentImageFromUrl(
          imageUrl,
          undefined'auto', 'small'
        );

        const objects = segmentation.masks.map(mask => ({
          bbox: mask.bbox,
          center: mask.center,
          confidence: mask.confidence,
        }));

        setDetectedObjects(objects);

        // Analyze composition
        const score = calculateCompositionScore(segmentation, objects);
        const suggestions = generateSuggestions(score, objects, segmentation.image_size);

        setCompositionScore(score);
        setSuggestions(suggestions);

        onAnalysisComplete?.({
          score,
          suggestions,
          objects,
        });

        // Save to database for persistence
        try {
          await apiRequest('/api/virtual-studio/save-analysis-result', {
            method: 'POST',
            headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({
              analysisType: 'composition',
              imageUrl,
              result: {
                score,
                objects,
                suggestions,
              },
            }),
          });
        } catch (error) {
          console.warn('Failed to save composition analysis to database: ', error);
          // Non-critical - continue even if save fails
        }

        return { score, suggestions, objects };
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error('Composition analysis failed:', error);
    },
  });

  const calculateCompositionScore = (
    segmentation: SAM2SegmentationResult,
    objects: Array<{ bbox: [number, number, number, number]; center: [number, number]; confidence: number }>
  ): CompositionScore => {
    const [width, height] = segmentation.image_size;

    // Rule of Thirds Score
    const ruleOfThirdsScore = calculateRuleOfThirdsScore(objects, width, height);

    // Symmetry Score
    const symmetryScore = calculateSymmetryScore(objects, width, height);

    // Balance Score
    const balanceScore = calculateBalanceScore(objects, width, height);

    // Subject Placement Score
    const subjectPlacementScore = calculateSubjectPlacementScore(objects, width, height);

    // Leading Lines Score (simplified - would need edge detection for full implementation)
    const leadingLinesScore = 75; // Placeholder

    // Overall Score (weighted average)
    const overall = Math.round(
      ruleOfThirdsScore * 0.3 +
      symmetryScore * 0.2 +
      balanceScore * 0.2 +
      subjectPlacementScore * 0.2 +
      leadingLinesScore * 0.1
    );

    return {
      overall,
      ruleOfThirds: ruleOfThirdsScore,
      symmetry: symmetryScore,
      balance: balanceScore,
      leadingLines: leadingLinesScore,
      subjectPlacement: subjectPlacementScore,
    };
  };

  const calculateRuleOfThirdsScore = (
    objects: Array<{ center: [number, number] }>,
    width: number,
    height: number
  ): number => {
    if (objects.length === 0) return 50;

    const thirdX = width / 3;
    const thirdY = height / 3;
    const twoThirdsX = (width * 2) / 3;
    const twoThirdsY = (height * 2) / 3;

    let score = 0;
    const tolerance = Math.min(width, height) * 0.1; // 10% tolerance

    objects.forEach(obj => {
      const [x, y] = obj.center;
      const distToThirdX = Math.min(
        Math.abs(x - thirdX),
        Math.abs(x - twoThirdsX)
      );
      const distToThirdY = Math.min(
        Math.abs(y - thirdY),
        Math.abs(y - twoThirdsY)
      );

      if (distToThirdX < tolerance && distToThirdY < tolerance) {
        score += 100;
      } else if (distToThirdX < tolerance || distToThirdY < tolerance) {
        score += 70;
      } else {
        score += 30;
      }
    });

    return Math.min(100, Math.round(score / objects.length));
  };

  const calculateSymmetryScore = (
    objects: Array<{ center: [number, number] }>,
    width: number,
    height: number
  ): number => {
    if (objects.length === 0) return 50;

    const centerX = width / 2;
    let symmetryScore = 0;

    objects.forEach(obj => {
      const [x] = obj.center;
      const distanceFromCenter = Math.abs(x - centerX);
      const maxDistance = width / 2;
      const symmetry = 1 - (distanceFromCenter / maxDistance);
      symmetryScore += symmetry * 100;
    });

    return Math.min(100, Math.round(symmetryScore / objects.length));
  };

  const calculateBalanceScore = (
    objects: Array<{ center: [number, number]; bbox: [number, number, number, number] }>,
    width: number,
    height: number
  ): number => {
    if (objects.length === 0) return 50;

    // Calculate visual weight (based on size and position)
    let leftWeight = 0;
    let rightWeight = 0;
    let topWeight = 0;
    let bottomWeight = 0;

    objects.forEach(obj => {
      const [x, y, w, h] = obj.bbox;
      const area = w * h;
      const weight = area / (width * height); // Normalized weight

      if (x < width / 2) {
        leftWeight += weight;
      } else {
        rightWeight += weight;
      }

      if (y < height / 2) {
        topWeight += weight;
      } else {
        bottomWeight += weight;
      }
    });

    // Calculate balance (closer to 0.5 is better)
    const horizontalBalance = Math.abs(0.5 - (leftWeight / (leftWeight + rightWeight || 1)));
    const verticalBalance = Math.abs(0.5 - (topWeight / (topWeight + bottomWeight || 1)));

    const balanceScore = (1 - (horizontalBalance + verticalBalance)) * 100;
    return Math.max(0, Math.round(balanceScore));
  };

  const calculateSubjectPlacementScore = (
    objects: Array<{ center: [number, number] }>,
    width: number,
    height: number
  ): number => {
    if (objects.length === 0) return 50;

    // Main subject is typically the largest or most centered object
    const mainSubject = objects[0]; // Simplified - would analyze size/position
    const [x, y] = mainSubject.center;

    // Ideal placement: slightly off-center, following rule of thirds
    const idealX = width * 0.4; // Slightly left of center
    const idealY = height * 0.4; // Slightly above center

    const distance = Math.sqrt(
      Math.pow(x - idealX, 2) + Math.pow(y - idealY, 2)
    );
    const maxDistance = Math.sqrt(width * width + height * height);
    const placementScore = (1 - distance / maxDistance) * 100;

    return Math.max(0, Math.round(placementScore));
  };

  const generateSuggestions = (
    score: CompositionScore,
    objects: Array<{ bbox: [number, number, number, number]; center: [number, number] }>,
    imageSize: [number, number]
  ): CompositionSuggestion[] => {
    const suggestions: CompositionSuggestion[] = [];

    // Rule of Thirds suggestions
    if (score.ruleOfThirds < 60) {
      suggestions.push({
        type: 'improvement',
        category: 'composition',
        message: 'Consider aligning main subjects with rule of thirds grid lines for better visual balance',
        priority: 'high',
        action: 'Show rule of thirds grid',
      });
    }

    // Balance suggestions
    if (score.balance < 50) {
      suggestions.push({
        type: 'improvement',
        category: 'balance',
        message: 'Scene appears unbalanced. Consider repositioning subjects to create visual equilibrium',
        priority: 'medium',
        action: 'Show balance guide',
      });
    }

    // Subject placement suggestions
    if (score.subjectPlacement < 60) {
      suggestions.push({
        type: 'tip',
        category: 'placement',
        message: 'Main subject could be better positioned. Try moving it slightly off-center',
        priority: 'medium',
      });
    }

    // Multiple subjects suggestions
    if (objects.length > 1) {
      suggestions.push({
        type: 'tip',
        category: 'group',
        message: `Detected ${objects.length} subjects. Ensure proper spacing and grouping`,
        priority: 'low',
      });
    }

    // Overall score feedback
    if (score.overall >= 80) {
      suggestions.push({
        type: 'tip',
        category: 'quality',
        message: 'Excellent composition! Scene is well-balanced and follows photographic principles',
        priority: 'low',
      });
    } else if (score.overall < 50) {
      suggestions.push({
        type: 'warning',
        category: 'quality',
        message: 'Composition could be significantly improved. Review suggestions above',
        priority: 'high',
      });
    }

    return suggestions;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FFC107'; // Yellow
    if (score >= 40) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesome />
            Scene Composition Analyzer
          </Typography>
          <Chip
            label={`${detectedObjects.length} object(s) detected`}
            size="small"
            color="primary"
          />
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to analyze composition
          </Alert>
        )}

        {imageUrl && (
          <>
            <Box>
              <Button
                variant="contained"
                startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoAwesome />}
                onClick={() => analyzeComposition.mutate()}
                disabled={isAnalyzing || !imageUrl}
                fullWidth
              >
                {isAnalyzing ? 'Analyzing Composition...' : 'Analyze Composition'}
              </Button>
            </Box>

            {compositionScore && (
              <>
                <Divider />

                {/* Overall Score */}
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Overall Composition Score
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box
                            sx={{
                              width: 80,
                              height: 80,
                              borderRadius: '50%',
                              bgcolor: getScoreColor(compositionScore.overall),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '1.5rem'}}
                          >
                            {compositionScore.overall}
                          </Box>
                          <Box>
                            <Typography variant="h6">
                              {getScoreLabel(compositionScore.overall)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Based on multiple composition factors
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Detailed Scores */}
                      <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Rule of Thirds</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {compositionScore.ruleOfThirds}
                          </Typography>
                        </Box>
                        <Slider
                          value={compositionScore.ruleOfThirds}
                          disabled
                          sx={{ color: getScoreColor(compositionScore.ruleOfThirds) }}
                        />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Balance</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {compositionScore.balance}
                          </Typography>
                        </Box>
                        <Slider
                          value={compositionScore.balance}
                          disabled
                          sx={{ color: getScoreColor(compositionScore.balance) }}
                        />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Subject Placement</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {compositionScore.subjectPlacement}
                          </Typography>
                        </Box>
                        <Slider
                          value={compositionScore.subjectPlacement}
                          disabled
                          sx={{ color: getScoreColor(compositionScore.subjectPlacement) }}
                        />

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Symmetry</Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {compositionScore.symmetry}
                          </Typography>
                        </Box>
                        <Slider
                          value={compositionScore.symmetry}
                          disabled
                          sx={{ color: getScoreColor(compositionScore.symmetry) }}
                        />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

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
                          severity={
                            suggestion.type === 'warning'
                              ? 'warning'
                              : suggestion.type === 'improvement'
                              ? 'info' : 'success'
                          }
                          icon={
                            suggestion.type === 'warning' ? (
                              <Warning />
                            ) : suggestion.type ==='improvement' ? (
                              <Info />
                            ) : (
                              <CheckCircle />
                            )
                          }
                        >
                          <Typography variant="body2">{suggestion.message}</Typography>
                          {suggestion.action && (
                            <Button
                              size="small"
                              sx={{ mt: 1 }}
                              onClick={() => {
                                if (suggestion.action?.includes('grid')) {
                                  setShowGrid(true);
                                  onOverlayToggle?.(true);
                                }
                              }}
                            >
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

            {/* Overlay Controls */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={showOverlay}
                    onChange={(e) => {
                      setShowGrid(e.target.checked);
                      onOverlayToggle?.(e.target.checked);
                    }}
                  />
                }
                label="Show Composition Grid Overlay"
              />
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}


























