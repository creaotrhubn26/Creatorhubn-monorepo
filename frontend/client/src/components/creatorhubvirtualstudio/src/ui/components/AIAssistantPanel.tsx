/**
 * AI Assistant Panel
 * 
 * Displays AI-powered lighting recommendations and quality analysis
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('AIAssistantPanel, ');
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  Button,
  Card,
  CardContent,
  CardActions,
  Divider,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Lightbulb as IdeaIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  School as LearnIcon,
  AutoAwesome as AIIcon,
  TrendingUp as ImprovementIcon,
} from '@mui/icons-material';
import { aiRecommendationService, type AIRecommendation } from '@/core/services/aiRecommendationService';
import type { LightSourceProperties } from '@/core/types';
import { sceneCompositionService } from '../../core/services/sceneCompositionService';
import { backgroundAnalysisService } from '../../core/services/backgroundAnalysisService';
import { sam2Service } from '@/services/SAM2Service';
import { Tabs, Tab } from '@mui/material';

interface AIAssistantPanelProps {
  lights: LightSourceProperties[];
  onApplyRecommendation: (recommendation: AIRecommendation) => void;
  imageUrl?: string; // Optional: For scene understanding
}

export function AIAssistantPanel({ lights, onApplyRecommendation, imageUrl }: AIAssistantPanelProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [sceneAnalysis, setSceneAnalysis] = useState<any>(null);
  const [backgroundAnalysis, setBackgroundAnalysis] = useState<any>(null);

  // Fetch recommendations (async for ML support)
  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        const result = await aiRecommendationService.getRecommendations(lights);
        setAnalysis(result);

        // If image URL provided, also analyze scene and background
        if (imageUrl) {
          try {
            const [composition, background] = await Promise.all([
              sceneCompositionService.analyzeComposition(imageUrl).catch(() => null),
              backgroundAnalysisService.analyzeBackground(imageUrl).catch(() => null),
            ]);
            setSceneAnalysis(composition);
            setBackgroundAnalysis(background);
          } catch (error) {
            log.warn('Scene/background analysis failed: ', error);
          }
        }
      } catch (error) {
        log.error('Failed to get AI recommendations: ', error);
        // Fallback to empty analysis
        setAnalysis({
          qualityScore: 0,
          grade: 'F',
          summary: 'Unable to analyze lighting setup',
          recommendations: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [lights, imageUrl]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#F44336';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <WarningIcon fontSize="small" />;
      case 'medium':
        return <IdeaIcon fontSize="small" />;
      case 'low':
        return <LearnIcon fontSize="small" />;
      default:
        return <IdeaIcon fontSize="small" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'quick-fix':
        return <WarningIcon fontSize="small" />;
      case 'pattern':
        return <AIIcon fontSize="small" />;
      case 'enhancement':
        return <ImprovementIcon fontSize="small" />;
      case 'learning':
        return <LearnIcon fontSize="small" />;
      default:
        return <IdeaIcon fontSize="small" />;
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return '#4CAF50';
    if (grade.startsWith('B')) return '#8BC34A';
    if (grade.startsWith('C')) return '#FF9800';
    if (grade.startsWith('D')) return '#F44336';
    return '#9E9E9E';
  };

  // Show loading state
  if (isLoading || !analysis) {
    return (
      <Paper elevation={0} sx={{ p: 2, bgcolor: '#f9f9f9', border: '1px solid #e0e0e0' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <AIIcon sx={{ color: '#1976d2' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
            AI Lighting Assistant
          </Typography>
        </Stack>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Analyzing lighting setup...
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#f9f9f9', border: '1px solid #e0e0e0' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <AIIcon sx={{ color: '#1976d2' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          AI Assistant
        </Typography>
        <Chip
          label={`${analysis.qualityScore}/100`}
          sx={{
            bgcolor: getGradeColor(analysis.grade),
            color: 'white',
            fontWeight: 600}}
        />
        <Chip
          label={`Grade ${analysis.grade}`}
          sx={{
            bgcolor: getGradeColor(analysis.grade),
            color: 'white',
            fontWeight: 600}}
        />
      </Stack>

      {/* Quality Score Bar */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#666' }}>
            Overall Quality
          </Typography>
          <Typography variant="caption" sx={{ color: '#666', fontWeight: 600}}>
            {analysis.qualityScore}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={analysis.qualityScore}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
              bgcolor: getGradeColor(analysis.grade),
            }}}
        />
      </Box>

      {/* Summary */}
      <Alert
        severity={analysis.qualityScore >= 75 ? 'success' : analysis.qualityScore >= 60 ? 'warning' : 'error'}
        icon={<AIIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="caption" sx={{ fontWeight: 500}}>
          {analysis.summary}
        </Typography>
      </Alert>

      <Divider sx={{ my: 2 }} />

      {/* Multi-Modal Tabs */}
      {(sceneAnalysis || backgroundAnalysis) && (
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Lighting" />
          {sceneAnalysis && <Tab label="Composition" />}
          {backgroundAnalysis && <Tab label="Background" />}
        </Tabs>
      )}

      {/* Lighting Recommendations */}
      {(activeTab === 0 || !sceneAnalysis) && (
        <>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1, color: '#666' }}>
            🎯 Lighting Recommendations ({analysis.recommendations.length})
          </Typography>

      <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
        <Stack spacing={1}>
          {analysis.recommendations.map((rec) => (
            <Card key={rec.id} variant="outlined" sx={{ bgcolor: 'white' }}>
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  {getPriorityIcon(rec.priority)}
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, fontSize: 13 }}>
                    {rec.title}
                  </Typography>
                  <Chip
                    label={rec.priority}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: 9,
                      bgcolor: getPriorityColor(rec.priority),
                      color: 'white'}}
                  />
                </Stack>

                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: '#666', fontSize: 11 }}>
                  {rec.description}
                </Typography>

                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{
                    bgcolor: 'transparent', '&:before': { display: 'none' },
                    mt: 0.5}}
                >
                  <AccordionSummary
                    expandIcon={<ExpandIcon sx={{ fontSize: 16 }} />}
                    sx={{ minHeight: 0, px: 0'& .MuiAccordionSummary-content': { my: 0.5 } }}
                  >
                    <Typography variant="caption" sx={{ fontSize: 10, color: '#1976d2', fontWeight: 500}}>
                      Why this matters
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0 }}>
                    <Typography variant="caption" sx={{ fontSize: 10, color: '#666' }}>
                      {rec.reasoning}
                    </Typography>
                    <Box sx={{ mt: 1, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <SuccessIcon sx={{ fontSize: 12, color: '#1976d2' }} />
                        <Typography variant="caption" sx={{ fontSize: 10, color: '#1976d2', fontWeight: 500}}>
                          Expected: {rec.expectedImprovement}
                        </Typography>
                      </Stack>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </CardContent>

              <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => onApplyRecommendation(rec)}
                  sx={{ textTransform: 'none', fontSize: 10 }}
                >
                  Apply
                </Button>
                <Chip
                  label={rec.difficulty}
                  size="small"
                  sx={{ height: 16, fontSize: 9, ml: 'auto' }}
                />
              </CardActions>
            </Card>
          ))}
        </Stack>
        </Box>
        </>
      )}

      {/* Composition Suggestions */}
      {activeTab === 1 && sceneAnalysis && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1, color: '#666' }}>
            🎨 Composition Analysis
          </Typography>
          <Alert severity={sceneAnalysis.score.overall >= 80 ? 'success' : 'info'} sx={{ mb: 2 }}>
            Composition Score: {sceneAnalysis.score.overall}%
          </Alert>
          <Stack spacing={1}>
            {sceneAnalysis.suggestions.map((suggestion: any, idx: number) => (
              <Card key={idx} variant="outlined" sx={{ bgcolor: 'white' }}>
                <CardContent sx={{ pb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
                    {suggestion.message}
                  </Typography>
                  <Chip
                    label={suggestion.priority}
                    size="small"
                    sx={{ mt: 1, height: 18, fontSize: 9 }}
                  />
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Background Suggestions */}
      {activeTab === 2 && backgroundAnalysis && (
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1, color: '#666' }}>
            🖼️ Background Analysis
          </Typography>
          <Alert severity={backgroundAnalysis.backgroundQuality >= 80 ? 'success' : 'warning'} sx={{ mb: 2 }}>
            Background Quality: {backgroundAnalysis.backgroundQuality}%
            {backgroundAnalysis.distractingElements.length > 0 && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                {backgroundAnalysis.distractingElements.length} distracting element(s) detected
              </Typography>
            )}
          </Alert>
          <Stack spacing={1}>
            {backgroundAnalysis.suggestions.map((suggestion: any, idx: number) => (
              <Card key={idx} variant="outlined" sx={{ bgcolor: 'white' }}>
                <CardContent sx={{ pb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
                    {suggestion.message}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Suggested Patterns */}
      {analysis.suggestedPatterns.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1, color: '#666' }}>
            🎬 Suggested Patterns
          </Typography>
          <Stack spacing={1}>
            {analysis.suggestedPatterns.map((pattern) => (
              <Box
                key={pattern.id}
                sx={{
                  p: 1,
                  bgcolor: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1}}
              >
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11 }}>
                  {pattern.name}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', fontSize: 9, color: '#666' }}>
                  {pattern.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </>
      )}

      {/* Footer */}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ color: '#1976d2', display: 'block', fontWeight: 600, fontSize: 10 }}>
          💡 AI-Powered Analysis
        </Typography>
        <Typography variant="caption" sx={{ color: '#1976d2', display: 'block', fontSize: 9 }}>
          Based on ASC standards, cinematography best practices, and industry research
        </Typography>
      </Box>
    </Paper>
  );
}

