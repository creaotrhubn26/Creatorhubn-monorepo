/**
 * Research Optimization Panel
 * 
 * UI for researching academic papers and optimizing Virtual Studio features
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('ResearchPanel, ');
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  Tabs,
  Tab,
  Divider,
  TextField,
} from '@mui/material';
import {
  Science as ScienceIcon,
  AutoFixHigh as OptimizeIcon,
  Assessment as AnalysisIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import researchBasedOptimizer, { FeatureOptimization } from '../../services/ResearchBasedOptimizer';

interface ResearchOptimizationPanelProps {
  renderer?: any; // EnhancedRenderer instance
  onOptimizationApplied?: (feature: string) => void;
  isAdmin: boolean; // Admin-only access
}

export const ResearchOptimizationPanel: React.FC<ResearchOptimizationPanelProps> = ({
  renderer,
  onOptimizationApplied,
  isAdmin,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [optimizations, setOptimizations] = useState<FeatureOptimization[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [optimizingFeature, setOptimizingFeature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string>(', ');
  const [quotaLimit, setQuotaLimit] = useState<number>(10); // Default: 10 API calls

  // Admin check
  if (!isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6">Access Denied</Typography>
          <Typography>
            The Research tab is only accessible to administrators.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            This feature uses Google Scholar research and optimization capabilities that require admin privileges.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Load optimizations on mount
  useEffect(() => {
    // Don't auto-analyze to save quota
    // User must click "Analyze All Features" button
  }, []);

  const analyzeFeatures = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      log.info(`Analyzing features with quota limit: ${quotaLimit} API calls, `);
      const results = await researchBasedOptimizer.analyzeAllFeatures(quotaLimit);
      setOptimizations(results);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze features');
      log.error('Analysis failed: ', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const optimizeFeature = async (feature: string) => {
    setOptimizingFeature(feature);
    setError(null);

    try {
      if (renderer) {
        await researchBasedOptimizer.applyOptimization(feature, renderer);
        onOptimizationApplied?.(feature);
      } else {
        await researchBasedOptimizer.optimizeFeature(feature);
      }

      // Refresh optimizations
      await analyzeFeatures();
    } catch (err: any) {
      setError(err.message || `Failed to optimize ${feature}`);
      log.error('Optimization failed: ', err);
    } finally {
      setOptimizingFeature(null);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const reportText = await researchBasedOptimizer.generateOptimizationReport();
      setReport(reportText);
      setActiveTab(2); // Switch to report tab
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `virtual-studio-optimization-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPriorityColor = (priority: FeatureOptimization['priority']) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ScienceIcon /> Research-Based Optimization
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Optimizations" icon={<OptimizeIcon />} iconPosition="start" />
        <Tab label="Analysis" icon={<AnalysisIcon />} iconPosition="start" />
        <Tab label="Report" icon={<DownloadIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab 0: Optimizations */}
      {activeTab === 0 && (
        <Box>
          {/* Quota Control */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>⚠️ API Quota Awareness:</strong> Each analysis uses Serpapi calls. Set your limit below.
            </Typography>
            <Typography variant="body2">
              • Free Trial: 100 calls/month | Developer: 5,000 calls/month ($50)
            </Typography>
            <Typography variant="body2">
              • Recommended: 10-20 calls per analysis (covers all features)
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <TextField
              label="Max API Calls"
              type="number"
              value={quotaLimit}
              onChange={(e) => setQuotaLimit(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
              sx={{ width: 150 }}
              slotProps={{ htmlInput: { min: 1, max: 50 } }}
              helperText="1-50 calls"
            />
            <Button
              variant="contained"
              onClick={analyzeFeatures}
              disabled={analyzing}
              startIcon={<AnalysisIcon />}
              sx={{ flexGrow: 1 }}
            >
              {analyzing ? `Analyzing (max ${quotaLimit} calls)...` : `Analyze Features (${quotaLimit} calls)`}
            </Button>
            <Button
              variant="outlined"
              onClick={generateReport}
              disabled={loading || optimizations.length === 0}
              startIcon={<DownloadIcon />}
            >
              Generate Report
            </Button>
          </Box>

          {analyzing && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Fetching research papers from Google Scholar... This may take a minute.
              </Typography>
            </Box>
          )}

          {optimizations.length === 0 && !analyzing && (
            <Alert severity="info">
              Click "Analyze All Features" to research optimization opportunities
            </Alert>
          )}

          {/* Optimization Cards */}
          {optimizations.map((opt) => (
            <Card key={opt.feature} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ textTransform: 'uppercase' }}>
                    {opt.feature.replace('-',', ')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={opt.priority}
                      color={getPriorityColor(opt.priority)}
                      size="small"
                    />
                    <Chip
                      label={`${(opt.estimatedImpact * 100).toFixed(0)}% Impact`}
                      color="primary"
                      size="small"
                    />
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  <strong>Current:</strong> {opt.currentImplementation}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  📚 Top Research Papers ({opt.papers.length}):
                </Typography>
                <List dense>
                  {opt.papers.slice(0, 3).map((paper, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={paper.title}
                        secondary={`${paper.authors.slice(0, 2).join(', ')} (${paper.year}) - ${paper.citations} citations`}
                      />
                    </ListItem>
                  ))}
                </List>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  ✨ Suggested Improvements ({opt.suggestedImprovements.length}):
                </Typography>
                <List dense>
                  {opt.suggestedImprovements.slice(0, 4).map((improvement, idx) => (
                    <ListItem key={idx}>
                      <ListItemText primary={`• ${improvement}`} />
                    </ListItem>
                  ))}
                </List>

                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={() => optimizeFeature(opt.feature)}
                  disabled={optimizingFeature === opt.feature}
                  startIcon={<OptimizeIcon />}
                  sx={{ mt: 2 }}
                >
                  {optimizingFeature === opt.feature ? 'Optimizing...' : 'Apply Optimization'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Tab 1: Analysis */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Research Statistics
          </Typography>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Features Analyzed: {optimizations.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Critical Priority: {optimizations.filter(o => o.priority === 'critical').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                High Priority: {optimizations.filter(o => o.priority === 'high').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Impact: {optimizations.length > 0 ? (optimizations.reduce((sum, o) => sum + o.estimatedImpact, 0) / optimizations.length * 100).toFixed(0) : 0}%
              </Typography>
            </CardContent>
          </Card>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Optimization History
          </Typography>

          <List>
            {researchBasedOptimizer.getOptimizationHistory().map((opt, idx) => (
              <ListItem key={idx}>
                <ListItemText
                  primary={`${opt.feature} - ${opt.papersAnalyzed} papers analyzed`}
                  secondary={`Applied: ${new Date(opt.appliedAt).toLocaleString()}`}
                />
              </ListItem>
            ))}
          </List>

          {researchBasedOptimizer.getOptimizationHistory().length === 0 && (
            <Alert severity="info">
              No optimizations applied yet. Apply optimizations from the Optimizations tab.
            </Alert>
          )}
        </Box>
      )}

      {/* Tab 2: Report */}
      {activeTab === 2 && (
        <Box>
          {report ? (
            <>
              <Button
                variant="contained"
                onClick={downloadReport}
                startIcon={<DownloadIcon />}
                sx={{ mb: 2 }}
              >
                Download Report
              </Button>
              <Card>
                <CardContent>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize:'12px' }}>
                    {report}
                  </pre>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert severity="info">
              Click"Generate Report" to create an optimization report
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ResearchOptimizationPanel;

