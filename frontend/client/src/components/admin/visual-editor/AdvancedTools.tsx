/**
 * Advanced Tools Panel Component
 * Quality analysis, AI tools, collaboration features
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import {
  ExpandMore,
  FlashOn,
  PlayArrow,
  Preview,
  Psychology,
  Refresh,
  Science,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/queryClient';
import { useEnhancedMasterIntegration } from '../../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';

interface AdvancedToolsProps {
  selectedProject?: { id: string; name?: string };
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void;
}

interface QualityCategoryScore {
  score: number;
}

interface QualityAnalysis {
  overallScore: number;
  categories: Record<string, QualityCategoryScore>;
  criticalIssues: string[];
}

interface AIInsight {
  id: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
}

const DEFAULT_QUALITY_ANALYSIS: QualityAnalysis = {
  overallScore: 0,
  categories: {},
  criticalIssues: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toQualityAnalysis = (value: unknown): QualityAnalysis => {
  if (!isRecord(value)) {
    return DEFAULT_QUALITY_ANALYSIS;
  }

  const overallScore = typeof value.overallScore === 'number' ? value.overallScore : 0;
  const categoriesSource = isRecord(value.categories) ? value.categories : {};
  const categories: Record<string, QualityCategoryScore> = Object.entries(categoriesSource).reduce(
    (acc, [key, item]) => {
      if (isRecord(item) && typeof item.score === 'number') {
        acc[key] = { score: item.score };
      }
      return acc;
    },
    {} as Record<string, QualityCategoryScore>,
  );

  const criticalIssues =
    Array.isArray(value.criticalIssues) && value.criticalIssues.every((issue) => typeof issue === 'string')
      ? value.criticalIssues
      : [];

  return {
    overallScore,
    categories,
    criticalIssues,
  };
};

const toAIInsights = (value: unknown): AIInsight[] => {
  const normalizeInsight = (entry: unknown, index: number): AIInsight | null => {
    if (!isRecord(entry)) {
      return null;
    }
    const content = typeof entry.content === 'string' ? entry.content : null;
    if (!content) {
      return null;
    }
    const priority =
      entry.priority === 'low' || entry.priority === 'medium' || entry.priority === 'high'
        ? entry.priority
        : 'medium';
    const id = typeof entry.id === 'string' ? entry.id : `insight-${Date.now()}-${index}`;
    return { id, content, priority };
  };

  if (Array.isArray(value)) {
    return value
      .map((entry, index) => normalizeInsight(entry, index))
      .filter((entry): entry is AIInsight => entry !== null);
  }

  if (isRecord(value) && Array.isArray(value.insights)) {
    return value.insights
      .map((entry, index) => normalizeInsight(entry, index))
      .filter((entry): entry is AIInsight => entry !== null);
  }

  return [];
};

export const AdvancedTools: React.FC<AdvancedToolsProps> = ({
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging, auth } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');

  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [qualityAnalysis, setQualityAnalysis] = useState<QualityAnalysis | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [vrPreviewOpen, setVrPreviewOpen] = useState(false);
  const [arPreviewOpen, setArPreviewOpen] = useState(false);

  useEffect(() => {
    const endTiming = performance.startTiming('advanced_tools_render');

    lifecycle.registerComponent({
      id: 'AdvancedTools',
      type: 'advanced-tools',
      version: '1.0.0',
      capabilities: {
        data: ['quality:analyze', 'ai:insights', 'vr:preview', 'ar:preview'],
        events: ['analysis:complete', 'insights:generated', 'preview:opened'],
        actions: ['quality:analyze', 'ai:generate', 'vr:preview', 'ar:preview'],
        ui: ['analysis:display', 'insights:show', 'preview:interface'],
        system: ['performance:monitor', 'analytics:track', 'debug:log'],
      },
      dependencies: ['@mui/material', 'EnhancedMasterIntegrationProvider'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('advanced_tools_mounted', {
      componentId: 'AdvancedTools',
      projectId: selectedProject?.id,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'AdvancedTools component mounted', {
      componentId: 'AdvancedTools',
      projectId: selectedProject?.id,
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('AdvancedTools');
      analytics.trackEvent('advanced_tools_unmounted', {
        componentId: 'AdvancedTools',
        timestamp: Date.now(),
      });
    };
  }, [analytics, debugging, lifecycle, performance, selectedProject?.id]);

  const qualityScoreColor = useMemo(() => {
    if (!qualityAnalysis) {
      return 'default' as const;
    }
    if (qualityAnalysis.overallScore >= 8) {
      return 'success' as const;
    }
    if (qualityAnalysis.overallScore >= 6) {
      return 'warning' as const;
    }
    return 'error' as const;
  }, [qualityAnalysis]);

  const handleRunQualityAnalysis = useCallback(async () => {
    setAnalysisLoading(true);

    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/quality-analysis/run', {
        body: {
          analysisType: 'comprehensive',
          componentName: 'CreatorhubVisualEditor',
          targetPath: 'client/src/components/admin/CreatorhubVisualEditor.tsx',
        },
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const parsedResult = toQualityAnalysis(response);
      setQualityAnalysis(parsedResult);

      onProjectUpdate?.({
        id: selectedProject?.id ?? 'active-project',
        qualityAnalysisAt: new Date().toISOString(),
        qualityScore: parsedResult.overallScore,
      });

      onNotificationCreate?.({
        id: `quality_analysis_${Date.now()}`,
        message: `Overall score: ${parsedResult.overallScore}/10`,
        priority: parsedResult.overallScore >= 8 ? 'low' : 'medium',
        source: 'quality_analysis',
        timestamp: new Date().toISOString(),
        title: 'Quality Analysis Completed',
        type: 'quality_analysis_completed',
      });
    } catch (error) {
      console.error('Quality analysis failed:', error);
      onNotificationCreate?.({
        id: `quality_analysis_error_${Date.now()}`,
        message: 'Failed to run quality analysis',
        priority: 'high',
        source: 'quality_analysis',
        timestamp: new Date().toISOString(),
        title: 'Analysis Failed',
        type: 'error',
      });
    } finally {
      setAnalysisLoading(false);
    }
  }, [auth, onNotificationCreate, onProjectUpdate, selectedProject?.id]);

  const generateAIInsights = useCallback(async () => {
    setIsGeneratingInsights(true);

    try {
      const headers = await auth.getAuthHeader();
      const response = await apiRequest('/api/ai/analyze-project', {
        body: {
          analysisType: 'comprehensive',
          projectId: selectedProject?.id,
        },
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const parsedInsights = toAIInsights(response);
      setAiInsights(parsedInsights);

      onNotificationCreate?.({
        id: `ai_insights_${Date.now()}`,
        message: `Generated ${parsedInsights.length} insights`,
        priority: 'medium',
        source: 'ai_analysis',
        timestamp: new Date().toISOString(),
        title: 'AI Analysis Complete',
        type: 'project_updated',
      });
    } catch (error) {
      console.error('AI insights generation failed:', error);
      onNotificationCreate?.({
        id: `ai_insights_error_${Date.now()}`,
        message: 'Failed to generate AI insights',
        priority: 'high',
        source: 'ai_analysis',
        timestamp: new Date().toISOString(),
        title: 'AI Analysis Failed',
        type: 'error',
      });
    } finally {
      setIsGeneratingInsights(false);
    }
  }, [auth, onNotificationCreate, selectedProject?.id]);

  return (
    <Paper sx={{ ...theming.getThemedCardSx(), m: 2, p: 3 }}>
      <Typography sx={{ color: theming.colors.primary, mb: 3 }} variant="h4">
        Advanced Tools
      </Typography>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box alignItems="center" display="flex" gap={1}>
            <Science />
            <Typography sx={{ color: theming.colors.primary }} variant="h6">
              Quality Assurance
            </Typography>
            {qualityAnalysis && (
              <Chip
                color={qualityScoreColor}
                label={`Score: ${qualityAnalysis.overallScore}/10`}
                size="small"
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Button
            onClick={() => setShowAnalysisDialog(true)}
            startIcon={<Refresh />}
            sx={{ ...theming.getThemedButtonSx(), mb: 2 }}
            variant="contained"
          >
            Run Quality Analysis
          </Button>

          {qualityAnalysis && (
            <Grid container spacing={2}>
              {Object.entries(qualityAnalysis.categories).map(([category, data]) => (
                <Grid item key={category} sm={6} xs={12}>
                  <Typography variant="subtitle2">
                    {category.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}
                  </Typography>
                  <LinearProgress value={data.score * 10} variant="determinate" />
                  <Typography variant="caption">{data.score}/10</Typography>
                </Grid>
              ))}
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box alignItems="center" display="flex" gap={1}>
            <Psychology />
            <Typography sx={{ color: theming.colors.primary }} variant="h6">
              AI-Powered Insights
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Button
            disabled={isGeneratingInsights}
            onClick={generateAIInsights}
            startIcon={isGeneratingInsights ? <CircularProgress size={16} /> : <FlashOn />}
            sx={{ mb: 2 }}
            variant="outlined"
          >
            Generate AI Insights
          </Button>

          {aiInsights.length > 0 && (
            <Box>
              {aiInsights.map((insight) => (
                <Alert key={insight.id} severity="info" sx={{ mb: 1 }}>
                  {insight.content}
                </Alert>
              ))}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box alignItems="center" display="flex" gap={1}>
            <Preview />
            <Typography sx={{ color: theming.colors.primary }} variant="h6">
              Advanced Preview
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button fullWidth onClick={() => setArPreviewOpen(true)} startIcon={<PlayArrow />} variant="outlined">
                AR Preview
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth onClick={() => setVrPreviewOpen(true)} startIcon={<PlayArrow />} variant="outlined">
                VR Preview
              </Button>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Dialog fullWidth maxWidth="lg" onClose={() => setShowAnalysisDialog(false)} open={showAnalysisDialog}>
        <DialogTitle>Quality Analysis - CreatorhubVisualEditor</DialogTitle>
        <DialogContent>
          <Box alignItems="center" display="flex" justifyContent="space-between" mb={3}>
            <Box>
              <Typography gutterBottom sx={{ color: theming.colors.primary }} variant="h6">
                Comprehensive Quality Analysis
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Analyze code quality, type safety, security, and performance
              </Typography>
            </Box>
            <Button
              disabled={analysisLoading}
              onClick={handleRunQualityAnalysis}
              startIcon={<Refresh />}
              variant="outlined"
            >
              {analysisLoading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Box>

          {qualityAnalysis && (
            <Box>
              <Card sx={{ ...theming.getThemedCardSx(), mb: 3 }}>
                <CardContent>
                  <Box alignItems="center" display="flex" gap={2} mb={2}>
                    <Box
                      sx={{
                        alignItems: 'center',
                        bgcolor:
                          qualityAnalysis.overallScore >= 8
                            ? 'success.light'
                            : qualityAnalysis.overallScore >= 6
                              ? 'warning.light'
                              : 'error.light',
                        borderRadius: '50%',
                        display: 'flex',
                        height: 80,
                        justifyContent: 'center',
                        width: 80,
                      }}
                    >
                      <Typography sx={{ color: theming.colors.primary }} variant="h4">
                        {qualityAnalysis.overallScore}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: theming.colors.primary }} variant="h6">
                        Overall Quality Score
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        Based on {Object.keys(qualityAnalysis.categories).length} analysis categories
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                {Object.entries(qualityAnalysis.categories).map(([category, data]) => (
                  <Grid item key={category} md={3} sm={4} xs={6}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent>
                        <Typography gutterBottom variant="subtitle2">
                          {category.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}
                        </Typography>
                        <LinearProgress sx={{ mb: 1 }} value={data.score * 10} variant="determinate" />
                        <Typography variant="caption">{data.score}/10</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {qualityAnalysis.criticalIssues.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography gutterBottom variant="subtitle2">
                    Critical Issues ({qualityAnalysis.criticalIssues.length})
                  </Typography>
                  {qualityAnalysis.criticalIssues.map((issue, index) => (
                    <Typography key={index} variant="body2">
                      • {issue}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalysisDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={() => setArPreviewOpen(false)} open={arPreviewOpen}>
        <DialogTitle>AR Preview Mode</DialogTitle>
        <DialogContent>
          <Typography>
            AR preview is ready for runtime integration and uses the same project scene graph and
            camera state as the visual editor.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={() => setVrPreviewOpen(false)} open={vrPreviewOpen}>
        <DialogTitle>VR Preview Mode</DialogTitle>
        <DialogContent>
          <Typography>
            VR preview uses the active project composition and supports headset playback pipelines
            once device streaming is enabled.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVrPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AdvancedTools;
