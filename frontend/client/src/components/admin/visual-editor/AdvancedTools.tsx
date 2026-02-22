/**
 * Advanced Tools Panel Component  
 * Quality analysis, AI tools, collaboration features
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '../../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import { apiRequest } from '../../../lib/queryClient';
import {
  Box,
  Typography,
  Paper,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Chip,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Science,
  Psychology,
  FlashOn,
  Security,
  Speed as Speed,
  BugReport,
  IntegrationInstructions as Integration,
  ColorLens,
  Refresh,
  PlayArrow,
  Stop,
  Preview,
  ExpandMore,
} from '@mui/icons-material';

interface AdvancedToolsProps {
  selectedProject?: { id: string; name?: string };
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void;
}

export const AdvancedTools: React.FC<AdvancedToolsProps> = ({
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging, auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('advanced_tools_render,');
    
    lifecycle.registerComponent({
      id: 'AdvancedTools',
      type: 'advanced-tools',
      version: '1.0.0',
      capabilities: {
        data: ['quality:analyze','ai:insights','vr:preview','ar:preview'],
        events: ['analysis:complete','insights:generated','preview:opened'],
        actions: ['quality:analyze','ai:generate','vr:preview','ar:preview'],
        ui: ['analysis:display','insights:show','preview:interface'],
        system: ['performance:monitor','analytics:track','debug:log'],
      },
      dependencies: ['@mui/material','EnhancedMasterIntegrationProvider'],
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
        timestamp: Date.now()
  });
  };
}, [analytics, lifecycle, performance, debugging, selectedProject?.id]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [qualityAnalysis, setQualityAnalysis] = useState<Record<string, unknown> | null>(null);
  const [aiInsights, setAiInsights] = useState<Record<string, unknown>[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [vrPreviewOpen, setVrPreviewOpen] = useState(false);
  const [arPreviewOpen, setArPreviewOpen] = useState(false);

  // Quality Analysis Function (from original massive file)
  const handleRunQualityAnalysis = useCallback(async () => {
    setAnalysisLoading(true);

    try {
      const headers = await auth.getAuthHeader();
      const analysisResult = await apiRequest('/api/quality-analysis/run', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify({
          targetPath: 'client/src/components/admin/CreatorhubVisualEditor.tsx',
          componentName: 'CreatorhubVisualEditor',
          analysisType: 'comprehensive'
    })
    });

      setQualityAnalysis(analysisResult);

      onNotificationCreate?.({
        id: `quality_analysis_${Date.now()}`,
        type: 'quality_analysis_completed',
        title: 'Quality Analysis Completed',
        message: `Overall, score: ${analysisResult.overallScore}/10`,
        priority: analysisResult.overallScore >= 8 ? 'low' : 'medium',
        source: 'quality_analysis',
        timestamp: new Date().toISOString()
  });

  } catch (error) {
      console.error('Quality analysis failed: ', error);
      onNotificationCreate?.({
        id: `quality_analysis_error_${Date.now()}`,
        type: 'error',
        title: 'Analysis Failed',
        message: 'Failed to run quality analysis',
        priority: 'high',
        source: 'quality_analysis',
        timestamp: new Date().toISOString()
  });
  } finally {
      setAnalysisLoading(false);
  }
}, [onNotificationCreate, auth]);

  // AI Insights Generation
  const generateAIInsights = useCallback(async () => {
    setIsGeneratingInsights(true);

    try {
      const headers = await auth.getAuthHeader();
      const aiInsights = await apiRequest('/api/ai/analyze-project', {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProject?.id,
          analysisType: 'comprehensive'
        })
      });

      setAiInsights(aiInsights);

      onNotificationCreate?.({
        id: `ai_insights_${Date.now()}`,
        type: 'project_updated',
        title: 'AI Analysis Complete',
        message: `Generated ${aiInsights.length} insights`,
        priority: 'medium',
        source: 'ai_analysis',
        timestamp: new Date().toISOString()
  });

  } catch (error) {
      console.error('AI insights generation failed:', error);
  } finally {
      setIsGeneratingInsights(false);
  }
}, [selectedProject, onNotificationCreate, auth]);

  return (
    <Paper sx={{ p:  3, m:  2 ,  ...theming.getThemedCardSx() }}>
      <Typography variant="h4" sx={{  mb:  3, display: 'flex', alignItems: 'center', gap:  1  }}>
        <Psychology />
        Advanced Tools
      </Typography>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <Science />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Quality Assurance</Typography>
            {qualityAnalysis && (
              <Chip 
                label={`Score: ${qualityAnalysis.overallScore}/10`}
                color={qualityAnalysis.overallScore >= 8 ? 'success' : 
                       qualityAnalysis.overallScore >= 6 ? 'warning' : 'error'}
                size="small"
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Button
            variant="contained"
            startIcon={theming.getThemedIcon('refresh')}
            onClick={() => setShowAnalysisDialog(true)}
            sx={{ ...theming.getThemedButtonSx(), mb: 2 }}
          >
            Run Quality Analysis
          </Button>
          
          {qualityAnalysis && (
            <Grid container spacing={2}>
              <Grid size={{ xs:  6 }}>
                <Typography variant="subtitle2">Type Safety</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={qualityAnalysis.categories.typeSafety.score * 10} 
                />
                <Typography variant="caption">
                  {qualityAnalysis.categories.typeSafety.score}/10
                </Typography>
              </Grid>
              <Grid size={{ xs:  6 }}>
                <Typography variant="subtitle2">Performance</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={qualityAnalysis.categories.performance.score * 10} 
                />
                <Typography variant="caption">
                  {qualityAnalysis.categories.performance.score}/10
                </Typography>
              </Grid>
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            <Psychology />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>AI-Powered Insights</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Button 
            variant="outlined"
            onClick={generateAIInsights}
            disabled={isGeneratingInsights}
            startIcon={isGeneratingInsights ? <CircularProgress size={16} /> : <FlashOn />}
            sx={{ mb:  2 }}
          >
            Generate AI Insights
          </Button>

          {aiInsights.length > 0 && (
            <Box>
              {aiInsights.map((insight, index) => (
                <Alert key={index} severity="info" sx={{ mb:  1 }}>
                  {insight.content}
                </Alert>
              ))}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            <Preview />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Advanced Preview</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs:  6 }}>
              <Button 
                variant="outlined"
                fullWidth
                onClick={() => setArPreviewOpen(true)}
                startIcon={<Preview />}
              >
                AR Preview
              </Button>
            </Grid>
            <Grid size={{ xs:  6 }}>
              <Button 
                variant="outlined"
                fullWidth
                onClick={() => setVrPreviewOpen(true)}
                startIcon={<Preview />}
              >
                VR Preview
              </Button>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Quality Analysis Dialog */}
      <Dialog
        open={showAnalysisDialog}
        onClose={() => setShowAnalysisDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Science />
            Quality Analysis - CreatorhubVisualEditor
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🔍 Comprehensive Quality Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Analyze code quality, type safety, security, and performance
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('refresh')}
              onClick={handleRunQualityAnalysis}
              disabled={analysisLoading}
            >
              {analysisLoading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Box>

          {qualityAnalysis && (
            <Box>
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box sx={{ 
                      width:  80, 
                      height:  80, 
                      borderRadius: '50, %', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      bgcolor: qualityAnalysis.overallScore >= 8 ? 'success.light' : 
                               qualityAnalysis.overallScore >= 6 ? 'warning.light' : 'error.light',
                      color: qualityAnalysis.overallScore >= 8 ? 'success.contrastText' : 
                             qualityAnalysis.overallScore >= 6 ? 'warning.contrastText' : 'error.contrastText'
                }}>
                      <Typography variant="h4" sx={{ color: theming.colors.primary }}>{qualityAnalysis.overallScore}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Overall Quality Score</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Based on {Object.keys(qualityAnalysis.categories).length} analysis categories
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              <Grid container spacing={2} sx={{ mb:  3 }}>
                {Object.entries(qualityAnalysis.categories).map(([category, data]: [string, unknown]) => (
                  <Grid size={{ xs:  6, sm:  4, md:  3 }} key={category}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="subtitle2" gutterBottom>
                          {category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={data.score * 10}
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="caption">{data.score}/10</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {qualityAnalysis.criticalIssues?.length > 0 && (
                <Alert severity="error" sx={{ mb:  2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Critical Issues ({qualityAnalysis.criticalIssues.length})
                  </Typography>
                  {qualityAnalysis.criticalIssues.map((issue: string, index: number) => (
                    <Typography variant="body2" key={index}>• {issue}</Typography>
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

      {/* AR Preview Dialog */}
      <Dialog open={arPreviewOpen} onClose={() => setArPreviewOpen(false)}>
        <DialogTitle>AR Preview Mode</DialogTitle>
        <DialogContent>
          <Typography>
            AR preview functionality would be implemented here with AR software integration.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* VR Preview Dialog */}
      <Dialog open={vrPreviewOpen} onClose={() => setVrPreviewOpen(false)}>
        <DialogTitle>VR Preview Mode</DialogTitle>
        <DialogContent>
          <Typography>
            VR preview functionality would be implemented here with VR headset integration.
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
