/**
 * Multi-Subject Analyzer
 * 
 * Uses SAM 2 to detect multiple subjects and analyze their relationships
 * Suggests optimal positioning for group photos
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
} from '@mui/material';
import {
  Groups,
  AutoAwesome,
  Straighten,
  CenterFocusStrong,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

interface Subject {
  id: string;
  bbox: [number, number, number, number];
  center: [number, number];
  confidence: number;
  area: number;
}

interface SubjectRelationship {
  subject1: string;
  subject2: string;
  distance: number; // Pixel distance
  angle: number; // Angle in degrees
  spacing: 'too-close' | 'good' | 'too-far';
}

interface GroupAnalysis {
  subjects: Subject[];
  relationships: SubjectRelationship[];
  spacingScore: number;
  alignmentScore: number;
  suggestions: Array<{
    type: 'spacing' | 'alignment' | 'composition';
    message: string;
    priority: 'high' | 'medium' | 'low';
    action?: string;
  }>;
}

interface MultiSubjectAnalyzerProps {
  imageUrl?: string;
  onAnalysisComplete?: (analysis: GroupAnalysis) => void;
  onPositioningSuggest?: (suggestions: Array<{ subjectId: string; newPosition: [number, number] }>) => void;
}

export function MultiSubjectAnalyzer({
  imageUrl,
  onAnalysisComplete,
  onPositioningSuggest,
}: MultiSubjectAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<GroupAnalysis | null>(null);
  const [minSpacing, setMinSpacing] = useState(100); // Minimum spacing in pixels

  const analyzeSubjects = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required ');
      }

      setIsAnalyzing(true);
      try {
        // Detect all subjects using SAM 2
        const segmentation = await sam2Service.segmentImageFromUrl(
          imageUrl,
          undefined'auto', 'small'
        );

        // Process subjects
        const subjects: Subject[] = segmentation.masks.map((mask, idx) => ({
          id: `subject_${idx}`,
          bbox: mask.bbox,
          center: mask.center,
          confidence: mask.confidence,
          area: mask.area,
        }));

        // Analyze relationships
        const relationships = analyzeSubjectRelationships(subjects, minSpacing);

        // Calculate scores
        const spacingScore = calculateSpacingScore(relationships);
        const alignmentScore = calculateAlignmentScore(subjects, segmentation.image_size);

        // Generate suggestions
        const suggestions = generateGroupSuggestions(
          subjects,
          relationships,
          spacingScore,
          alignmentScore,
          segmentation.image_size
        );

        const analysisResult: GroupAnalysis = {
          subjects,
          relationships,
          spacingScore,
          alignmentScore,
          suggestions,
        };

        setAnalysis(analysisResult);
        onAnalysisComplete?.(analysisResult);

        // Generate positioning suggestions
        const positioningSuggestions = generatePositioningSuggestions(
          subjects,
          relationships,
          segmentation.image_size
        );
        onPositioningSuggest?.(positioningSuggestions);

        return analysisResult;
      } finally {
        setIsAnalyzing(false);
      }
    },
    onError: (error: any) => {
      console.error('Multi-subject analysis failed:', error);
    },
  });

  const analyzeSubjectRelationships = (
    subjects: Subject[],
    minSpacing: number
  ): SubjectRelationship[] => {
    const relationships: SubjectRelationship[] = [];

    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        const subj1 = subjects[i];
        const subj2 = subjects[j];

        const dx = subj2.center[0] - subj1.center[0];
        const dy = subj2.center[1] - subj1.center[1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        let spacing: 'too-close' | 'good' | 'too-far' = 'good';
        if (distance < minSpacing) {
          spacing = 'too-close';
        } else if (distance > minSpacing * 3) {
          spacing = 'too-far';
        }

        relationships.push({
          subject1: subj1.id,
          subject2: subj2.id,
          distance,
          angle,
          spacing,
        });
      }
    }

    return relationships;
  };

  const calculateSpacingScore = (relationships: SubjectRelationship[]): number => {
    if (relationships.length === 0) return 100;

    let score = 0;
    relationships.forEach(rel => {
      if (rel.spacing === 'good') {
        score += 100;
      } else if (rel.spacing === 'too-close') {
        score += 30;
      } else {
        score += 60;
      }
    });

    return Math.round(score / relationships.length);
  };

  const calculateAlignmentScore = (
    subjects: Subject[],
    imageSize: [number, number]
  ): number => {
    if (subjects.length < 2) return 100;

    // Check horizontal alignment
    const yPositions = subjects.map(s => s.center[1]);
    const yVariance = calculateVariance(yPositions);
    const maxVariance = imageSize[1] * 0.1; // 10% of image height
    const alignmentScore = Math.max(0, 100 - (yVariance / maxVariance) * 100);

    return Math.round(alignmentScore);
  };

  const calculateVariance = (values: number[]): number => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  };

  const generateGroupSuggestions = (
    subjects: Subject[],
    relationships: SubjectRelationship[],
    spacingScore: number,
    alignmentScore: number,
    imageSize: [number, number]
  ): GroupAnalysis['suggestions'] => {
    const suggestions: GroupAnalysis['suggestions'] = [];

    // Spacing suggestions
    if (spacingScore < 60) {
      const tooClose = relationships.filter(r => r.spacing === 'too-close').length;
      if (tooClose > 0) {
        suggestions.push({
          type: 'spacing',
          message: `${tooClose} pair(s) of subjects are too close together. Increase spacing for better composition`,
          priority: 'high',
          action: 'Show spacing guide',
        });
      }

      const tooFar = relationships.filter(r => r.spacing === 'too-far').length;
      if (tooFar > 0) {
        suggestions.push({
          type: 'spacing',
          message: `${tooFar} pair(s) of subjects are too far apart. Bring them closer for better group cohesion`,
          priority: 'medium',
        });
      }
    }

    // Alignment suggestions
    if (alignmentScore < 70) {
      suggestions.push({
        type: 'alignment',
        message: 'Subjects are not well-aligned. Consider aligning heads at similar heights',
        priority: 'medium',
        action: 'Show alignment guide',
      });
    }

    // Composition suggestions
    if (subjects.length > 3) {
      suggestions.push({
        type: 'composition',
        message: `Large group (${subjects.length} subjects). Consider arranging in rows or pyramid formation`,
        priority: 'low',
      });
    }

    // Overall feedback
    if (spacingScore >= 80 && alignmentScore >= 80) {
      suggestions.push({
        type: 'composition',
        message: 'Excellent group arrangement! Subjects are well-spaced and aligned',
        priority: 'low',
      });
    }

    return suggestions;
  };

  const generatePositioningSuggestions = (
    subjects: Subject[],
    relationships: SubjectRelationship[],
    imageSize: [number, number]
  ): Array<{ subjectId: string; newPosition: [number, number] }> => {
    const suggestions: Array<{ subjectId: string; newPosition: [number, number] }> = [];

    // Suggest optimal positions based on relationships
    relationships.forEach(rel => {
      if (rel.spacing === 'too-close') {
        const subj1 = subjects.find(s => s.id === rel.subject1);
        const subj2 = subjects.find(s => s.id === rel.subject2);
        if (subj1 && subj2) {
          // Suggest moving subjects apart
          const dx = subj2.center[0] - subj1.center[0];
          const dy = subj2.center[1] - subj1.center[1];
          const distance = Math.sqrt(dx * dx + dy * dy);
          const desiredDistance = minSpacing * 1.5;

          if (distance > 0) {
            const scale = desiredDistance / distance;
            const newDx = dx * scale;
            const newDy = dy * scale;

            // Suggest new position for subject 2
            const newX = Math.max(0, Math.min(imageSize[0], subj1.center[0] + newDx));
            const newY = Math.max(0, Math.min(imageSize[1], subj1.center[1] + newDy));

            suggestions.push({
              subjectId: rel.subject2,
              newPosition: [newX, newY],
            });
          }
        }
      }
    });

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
            <Groups />
            Multi-Subject Analyzer
          </Typography>
          {analysis && (
            <Chip
              label={`${analysis.subjects.length} subject(s)`}
              size="small"
              color="primary"
            />
          )}
        </Box>

        {/* Spacing Threshold */}
        <Box>
          <Typography variant="body2" gutterBottom>
            Minimum Spacing: {minSpacing}px
          </Typography>
          <Slider
            value={minSpacing}
            onChange={(_, v) => setMinSpacing(v as number)}
            min={50}
            max={300}
            step={10}
          />
        </Box>

        {!imageUrl && (
          <Alert severity="info">
            Capture or load an image to analyze multiple subjects
          </Alert>
        )}

        {imageUrl && (
          <>
            <Button
              variant="contained"
              startIcon={isAnalyzing ? <CircularProgress size={16} /> : <AutoAwesome />}
              onClick={() => analyzeSubjects.mutate()}
              disabled={isAnalyzing || !imageUrl}
              fullWidth
            >
              {isAnalyzing ? 'Analyzing Subjects...' : 'Analyze Group Composition'}
            </Button>

            {analysis && (
              <>
                {/* Scores */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Spacing Score
                        </Typography>
                        <Box
                          sx={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            bgcolor: getScoreColor(analysis.spacingScore),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            mx: 'auto'}}
                        >
                          {analysis.spacingScore}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Alignment Score
                        </Typography>
                        <Box
                          sx={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            bgcolor: getScoreColor(analysis.alignmentScore),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            mx: 'auto'}}
                        >
                          {analysis.alignmentScore}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Subjects */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Detected Subjects
                    </Typography>
                    <Stack spacing={1}>
                      {analysis.subjects.map((subject, idx) => (
                        <Box key={subject.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">
                            Subject {idx + 1}
                          </Typography>
                          <Chip
                            label={`${(subject.confidence * 100).toFixed(0)}% confidence`}
                            size="small"
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Relationships */}
                {analysis.relationships.length > 0 && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Subject Relationships
                      </Typography>
                      <Stack spacing={1}>
                        {analysis.relationships.map((rel, idx) => (
                          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">
                              {rel.subject1} ↔ {rel.subject2}
                            </Typography>
                            <Chip
                              label={`${rel.distance.toFixed(0)}px - ${rel.spacing}`}
                              size="small"
                              color={rel.spacing === 'good' ? 'success' : rel.spacing === 'too-close' ? 'error' : 'warning'}
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


























