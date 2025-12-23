/**
 * Pose Detection Panel
 * 
 * Detects body pose from captured images and compares against ideal poses
 * Suggests pose adjustments in real-time
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
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Accessibility,
  AutoAwesome,
  CheckCircle,
  Warning,
  TrendingUp,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';

interface PoseLandmark {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface PoseAnalysis {
  posture: string;
  stance: string;
  symmetry: number;
  angles: Record<string, number>;
}

interface PoseDetectionResult {
  success: boolean;
  landmarks: PoseLandmark[];
  analysis: PoseAnalysis;
  image_size: [number, number];
}

interface IdealPose {
  name: string;
  description: string;
  keyPoints: string[];
  idealAngles: Record<string, number>;
}

interface PoseDetectionPanelProps {
  imageUrl?: string;
  onPoseDetected?: (result: PoseDetectionResult) => void;
  onPoseComparison?: (comparison: { similarity: number; suggestions: string[] }) => void;
}

const IDEAL_POSES: IdealPose[] = [
  {
    name: 'Portrait - Upright',
    description: 'Standard portrait pose with upright posture',
    keyPoints: ['nose','left_shoulder','right_shoulder','left_hip','right_hip'],
    idealAngles: {
      head_shoulder: 0,
    },
  },
  {
    name: 'Portrait - Slight Lean',
    description: 'Slight forward lean for dynamic portrait',
    keyPoints: ['nose','left_shoulder','right_shoulder'],
    idealAngles: {
      head_shoulder: -5,
    },
  },
  {
    name: 'Group - Balanced',
    description: 'Balanced stance for group photos',
    keyPoints: ['left_hip','right_hip','left_knee','right_knee'],
    idealAngles: {},
  },
];

export function PoseDetectionPanel({
  imageUrl,
  onPoseDetected,
  onPoseComparison,
}: PoseDetectionPanelProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<PoseDetectionResult | null>(null);
  const [selectedIdealPose, setSelectedIdealPose] = useState<IdealPose | null>(null);
  const [comparison, setComparison] = useState<{ similarity: number; suggestions: string[] } | null>(null);

  const detectPose = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required, ');
      }

      setIsDetecting(true);
      try {
        // Convert image URL to file for upload
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'pose-image.jpg,', { type: blob.type });

        const formData = new FormData();
        formData.append('image', file);

        const apiResponse = await apiRequest('/api/virtual-studio/detect-pose', {
          method: 'POST',
          body: formData,
        });

        if (apiResponse.success && apiResponse.result) {
          const poseResult: PoseDetectionResult = apiResponse.result;
          setResult(poseResult);
          onPoseDetected?.(poseResult);
          return poseResult;
        } else {
          throw new Error(apiResponse.message || 'Pose detection failed');
        }
      } finally {
        setIsDetecting(false);
      }
    },
    onError: (error: any) => {
      console.error('Pose detection failed: ', error);
    },
  });

  const compareWithIdeal = (idealPose: IdealPose) => {
    if (!result) return;

    setSelectedIdealPose(idealPose);
    
    // Compare detected pose with ideal
    const suggestions: string[] = [];
    let similarity = 100;

    // Compare posture
    if (idealPose.idealAngles.head_shoulder !== undefined) {
      const detectedAngle = result.analysis.angles.head_shoulder || 0;
      const idealAngle = idealPose.idealAngles.head_shoulder;
      const angleDiff = Math.abs(detectedAngle - idealAngle);

      if (angleDiff > 10) {
        suggestions.push(`Adjust head position: ${angleDiff > 0 ? 'lean back slightly' : 'lean forward slightly'}`);
        similarity -= 20;
      }
    }

    // Compare symmetry
    if (result.analysis.symmetry < 80) {
      suggestions.push('Improve symmetry: Align shoulders and hips horizontally');
      similarity -= 15;
    }

    // Compare stance
    if (idealPose.name.includes('Balanced') && result.analysis.stance !== 'balanced') {
      suggestions.push(`Adjust stance: Distribute weight evenly (currently: ${result.analysis.stance})`);
      similarity -= 10;
    }

    const comparisonResult = {
      similarity: Math.max(0, similarity),
      suggestions,
    };

    setComparison(comparisonResult);
    onPoseComparison?.(comparisonResult);
  };

  const getPostureColor = (posture: string): string => {
    switch (posture) {
      case 'upright':
        return '#4CAF50';
      case 'leaning_forward':
      case 'leaning_back':
        return '#FFC107';
      default:
        return '#9E9E9E';
    }
  };

  const getPostureLabel = (posture: string): string => {
    switch (posture) {
      case 'upright':
        return 'Upright';
      case 'leaning_forward':
        return 'Leaning Forward';
      case 'leaning_back':
        return 'Leaning Back';
      default:
        return posture;
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Accessibility />
            Pose Detection
          </Typography>
          {result && (
            <Chip
              label={`${result.landmarks.length} landmarks`}
              size="small"
              color="primary"
            />
          )}
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to detect pose
          </Alert>
        )}

        {imageUrl && (
          <>
            <Button
              variant="contained"
              startIcon={isDetecting ? <CircularProgress size={16} /> : <AutoAwesome />}
              onClick={() => detectPose.mutate()}
              disabled={isDetecting || !imageUrl}
              fullWidth
            >
              {isDetecting ? 'Detecting Pose...' : 'Detect Body Pose'}
            </Button>

            {result && (
              <>
                {/* Pose Analysis */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Pose Analysis
                    </Typography>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Posture
                        </Typography>
                        <Chip
                          label={getPostureLabel(result.analysis.posture)}
                          size="small"
                          sx={{ bgcolor: getPostureColor(result.analysis.posture), color: 'white', mt: 0.5 }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Stance
                        </Typography>
                        <Chip
                          label={result.analysis.stance.replace('_', ', ')}
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Symmetry Score
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Typography variant="h6">{result.analysis.symmetry.toFixed(0)}%</Typography>
                          <Chip
                            label={result.analysis.symmetry >= 80 ? 'Good' : result.analysis.symmetry >= 60 ? 'Fair' : 'Poor'}
                            size="small"
                            color={result.analysis.symmetry >= 80 ? 'success' : result.analysis.symmetry >= 60 ? 'warning' : 'error'}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Key Landmarks */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Key Landmarks ({result.landmarks.length})
                    </Typography>
                    <List dense>
                      {result.landmarks
                        .filter(lm => lm.visibility > 0.5)
                        .slice(0, 10)
                        .map((landmark, idx) => (
                          <ListItem key={idx}>
                            <ListItemText
                              primary={landmark.name}
                              secondary={`(${landmark.x.toFixed(0)}, ${landmark.y.toFixed(0)}) - ${(landmark.visibility * 100).toFixed(0)}% visible`}
                            />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                </Card>

                {/* Compare with Ideal Poses */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Compare with Ideal Poses
                  </Typography>
                  <Stack spacing={1}>
                    {IDEAL_POSES.map((idealPose, idx) => (
                      <Card
                        key={idx}
                        variant="outlined"
                        sx={{
                          cursor: 'pointer',
                          border: selectedIdealPose?.name === idealPose.name ? 2 : 1,
                          borderColor: selectedIdealPose?.name === idealPose.name ? 'primary.main' : 'divider'}}
                        onClick={() => compareWithIdeal(idealPose)}
                      >
                        <CardContent>
                          <Typography variant="body2" fontWeight={600}>
                            {idealPose.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {idealPose.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>

                {/* Comparison Results */}
                {comparison && selectedIdealPose && (
                  <Card variant="outlined" sx={{ bgcolor: 'success.light' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Comparison with {selectedIdealPose.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Typography variant="h6">
                          Similarity: {comparison.similarity}%
                        </Typography>
                        <Chip
                          label={comparison.similarity >= 80 ? 'Excellent Match' : comparison.similarity >= 60 ? 'Good Match' : 'Needs Adjustment'}
                          color={comparison.similarity >= 80 ? 'success' : comparison.similarity >= 60 ? 'warning' : 'error'}
                        />
                      </Box>
                      {comparison.suggestions.length > 0 && (
                        <Box>
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Suggestions:
                          </Typography>
                          <Stack spacing={1}>
                            {comparison.suggestions.map((suggestion, idx) => (
                              <Alert key={idx} severity="info" icon={<TrendingUp />}>
                                {suggestion}
                              </Alert>
                            ))}
                          </Stack>
                        </Box>
                      )}
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


























