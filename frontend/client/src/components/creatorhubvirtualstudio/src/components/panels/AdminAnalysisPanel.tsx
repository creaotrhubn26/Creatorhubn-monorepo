/**
 * Admin Analysis Panel
 * 
 * Admin-only panel for analyzing Virtual Studio components
 * Uses web scraping (no API) to research improvements
 */

import { logger } from '../../core/services/logger';

const log = logger.module('AdminAnalysis, ');

import React, { useState } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  BugReport as BugIcon,
  TipsAndUpdates as ImprovementIcon,
  School as ResearchIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import virtualStudioAnalyzer, { 
  type VirtualStudioAnalysisResult,
  type ComponentAnalysis,
} from '../../../../../services/VirtualStudioAnalyzer';
import googleScholarScraper, { type ScrapedPaper } from '../../../../../services/GoogleScholarScraper';

interface AdminAnalysisPanelProps {
  isAdmin: boolean;
  onClose?: () => void;
}

const AdminAnalysisPanel: React.FC<AdminAnalysisPanelProps> = ({ isAdmin, onClose }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [researching, setResearching] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VirtualStudioAnalysisResult | null>(null);
  const [researchResults, setResearchResults] = useState<Map<string, ScrapedPaper[]>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Admin check
  if (!isAdmin) {
    return (
      <Alert severity="error">
        <Typography variant="h6">Access Denied</Typography>
        <Typography>This panel is only accessible to administrators.</Typography>
      </Alert>
    );
  }

  /**
   * Analyze Virtual Studio components
   */
  const analyzeComponents = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      log.info('Starting Virtual Studio analysis..., ');
      const result = await virtualStudioAnalyzer.analyzeVirtualStudio();
      setAnalysisResult(result);
      log.debug('Analysis complete: ', result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze components');
      log.error('Analysis failed: ', err);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Research improvements using web scraping
   */
  const researchImprovements = async () => {
    if (!analysisResult) {
      setError('Please analyze components first');
      return;
    }

    setResearching(true);
    setError(null);

    try {
      log.info('Starting research via web scraping...');

      // Get top 5 components that need improvement
      const topComponents = analysisResult.analyses
        .filter(a => a.priority === 'critical' || a.priority === 'high')
        .slice(0, 5);

      const results = new Map<string, ScrapedPaper[]>();

      for (const component of topComponents) {
        log.debug(`Researching ${component.componentName}...`);
        
        // Research top 3 queries for this component
        const queries = component.researchQueries.slice(0, 3);
        const papers = await googleScholarScraper.researchComponentImprovements(
          component.componentName,
          queries,
          3 // Max 3 papers per query
        );

        results.set(component.componentName, papers);
      }

      setResearchResults(results);
      log.info('Research complete');

    } catch (err: any) {
      setError(err.message || 'Failed to research improvements');
      log.error('Research failed:', err);
    } finally {
      setResearching(false);
    }
  };

  /**
   * Download analysis report
   */
  const downloadReport = () => {
    if (!analysisResult) return;

    const report = generateMarkdownReport(analysisResult, researchResults);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `virtual-studio-analysis-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Get priority color
   */
  const getPriorityColor = (priority: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  /**
   * Get health color
   */
  const getHealthColor = (health: number): string => {
    if (health >= 0.8) return '#4caf50'; // Green
    if (health >= 0.6) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          <AnalyticsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Virtual Studio Analysis (Admin)
        </Typography>
        {onClose && (
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        )}
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>🔍 Contextual Analysis:</strong> This tool analyzes your Virtual Studio codebase to identify components that need enhancement.
        </Typography>
        <Typography variant="body2">
          <strong>📚 Web Scraping:</strong> Uses Google Scholar web scraping (no API required) to research improvements.
        </Typography>
        <Typography variant="body2">
          <strong>🔒 Admin Only:</strong> This feature is only accessible to administrators.
        </Typography>
      </Alert>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          onClick={analyzeComponents}
          disabled={analyzing}
          startIcon={analyzing ? <RefreshIcon /> : <AnalyticsIcon />}
        >
          {analyzing ? 'Analyzing...' : 'Analyze Components'}
        </Button>

        <Button
          variant="contained"
          onClick={researchImprovements}
          disabled={researching || !analysisResult}
          startIcon={<ResearchIcon />}
          color="secondary"
        >
          {researching ? 'Researching...' : 'Research Improvements'}
        </Button>

        <Button
          variant="outlined"
          onClick={downloadReport}
          disabled={!analysisResult}
          startIcon={<DownloadIcon />}
        >
          Download Report
        </Button>
      </Box>

      {/* Progress */}
      {(analyzing || researching) && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {analyzing && 'Analyzing Virtual Studio components...'}
            {researching && 'Scraping Google Scholar for research papers... This may take a few minutes.'}
          </Typography>
        </Box>
      )}

      {/* Tabs */}
      {analysisResult && (
        <>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label="Overview" icon={<AnalyticsIcon />} />
            <Tab label="Component Analysis" icon={<BugIcon />} />
            <Tab label="Research Papers" icon={<ResearchIcon />} />
            <Tab label="Recommendations" icon={<ImprovementIcon />} />
          </Tabs>

          {/* Tab 0: Overview */}
          {activeTab === 0 && (
            <Box>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Overall Health</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={analysisResult.overallHealth * 100}
                        sx={{
                          height: 20,
                          borderRadius: 1,
                          backgroundColor: '#e0e0e0', '& .MuiLinearProgress-bar': {
                            backgroundColor: getHealthColor(analysisResult.overallHealth),
                          }}}
                      />
                    </Box>
                    <Typography variant="h6" sx={{ color: getHealthColor(analysisResult.overallHealth) }}>
                      {(analysisResult.overallHealth * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Total Components</Typography>
                    <Typography variant="h4">{analysisResult.totalComponents}</Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Critical Issues</Typography>
                    <Typography variant="h4" color="error">{analysisResult.criticalIssues}</Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">High Priority</Typography>
                    <Typography variant="h4" color="warning.main">{analysisResult.highPriorityImprovements}</Typography>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">Analyzed</Typography>
                    <Typography variant="h4">{analysisResult.componentsAnalyzed}</Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}

          {/* Tab 1: Component Analysis */}
          {activeTab === 1 && (
            <Box>
              {analysisResult.analyses.map((analysis) => (
                <Accordion key={analysis.componentPath} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {analysis.componentName}
                      </Typography>
                      <Chip
                        label={analysis.priority.toUpperCase()}
                        color={getPriorityColor(analysis.priority)}
                        size="small"
                      />
                      <Chip
                        label={`${analysis.issues.length} issues`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${(analysis.estimatedImpact * 100).toFixed(0)}% impact`}
                        size="small"
                        color="info"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" gutterBottom>
                      <strong>Current Implementation:</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {analysis.currentImplementation}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      <BugIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      <strong>Issues ({analysis.issues.length}):</strong>
                    </Typography>
                    <List dense>
                      {analysis.issues.map((issue, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={`• ${issue}`} />
                        </ListItem>
                      ))}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      <ImprovementIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      <strong>Suggested Improvements ({analysis.suggestedImprovements.length}):</strong>
                    </Typography>
                    <List dense>
                      {analysis.suggestedImprovements.map((improvement, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={`• ${improvement}`} />
                        </ListItem>
                      ))}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>
                      <ResearchIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                      <strong>Research Queries ({analysis.researchQueries.length}):</strong>
                    </Typography>
                    <List dense>
                      {analysis.researchQueries.map((query, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={`• ${query}`} />
                        </ListItem>
                      ))}
                    </List>

                    {analysis.relatedComponents.length > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          <strong>Related Components:</strong>
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {analysis.relatedComponents.map((comp) => (
                            <Chip key={comp} label={comp} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}

          {/* Tab 2: Research Papers */}
          {activeTab === 2 && (
            <Box>
              {researchResults.size === 0 ? (
                <Alert severity="info">
                  Click "Research Improvements" to scrape Google Scholar for relevant papers.
                </Alert>
              ) : (
                Array.from(researchResults.entries()).map(([componentName, papers]) => (
                  <Card key={componentName} sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {componentName} ({papers.length} papers)
                      </Typography>
                      <List>
                        {papers.slice(0, 10).map((paper, idx) => (
                          <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Link href={paper.scholarUrl} target="_blank" rel="noopener">
                              <Typography variant="subtitle2">{paper.title}</Typography>
                            </Link>
                            <Typography variant="caption" color="text.secondary">
                              {paper.authors.slice(0, 3).join(', ')} ({paper.year}) • {paper.citations} citations
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {paper.abstract.slice(0, 200)}...
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              <Chip
                                label={`Relevance: ${(paper.relevanceScore * 100).toFixed(0)}%`}
                                size="small"
                                color="primary"
                              />
                              {paper.pdfUrl && (
                                <Chip
                                  label="PDF Available"
                                  size="small"
                                  color="success"
                                  sx={{ ml: 1 }}
                                  component="a"
                                  href={paper.pdfUrl}
                                  target="_blank"
                                  clickable
                                />
                              )}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          )}

          {/* Tab 3: Recommendations */}
          {activeTab === 3 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Prioritized Action Items</strong>
                </Typography>
                <Typography variant="body2">
                  These recommendations are generated based on the analysis of your Virtual Studio components.
                </Typography>
              </Alert>

              <List>
                {analysisResult.recommendations.map((recommendation, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={recommendation}
                      primaryTypographyProps={{ variant:'body1' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default AdminAnalysisPanel;

/**
 * Generate Markdown report
 */
function generateMarkdownReport(
  analysis: VirtualStudioAnalysisResult,
  research: Map<string, ScrapedPaper[]>
): string {
  let report = `# Virtual Studio Analysis Report\n\n`;
  report += `**Generated:** ${new Date(analysis.timestamp).toLocaleString()}\n\n`;
  report += `---\n\n`;

  // Overview
  report += `## Overview\n\n`;
  report += `- **Overall Health:** ${(analysis.overallHealth * 100).toFixed(0)}%\n`;
  report += `- **Total Components:** ${analysis.totalComponents}\n`;
  report += `- **Components Analyzed:** ${analysis.componentsAnalyzed}\n`;
  report += `- **Critical Issues:** ${analysis.criticalIssues}\n`;
  report += `- **High Priority Improvements:** ${analysis.highPriorityImprovements}\n\n`;

  // Recommendations
  report += `## Recommendations\n\n`;
  analysis.recommendations.forEach((rec) => {
    report += `- ${rec}\n`;
  });
  report += `\n`;

  // Component Analysis
  report += `## Component Analysis\n\n`;
  analysis.analyses.forEach((comp) => {
    report += `### ${comp.componentName}\n\n`;
    report += `**Priority:** ${comp.priority.toUpperCase()} | `;
    report += `**Impact:** ${(comp.estimatedImpact * 100).toFixed(0)}%\n\n`;
    report += `**Current Implementation:** ${comp.currentImplementation}\n\n`;

    if (comp.issues.length > 0) {
      report += `**Issues:**\n`;
      comp.issues.forEach((issue) => {
        report += `- ${issue}\n`;
      });
      report += `\n`;
    }

    if (comp.suggestedImprovements.length > 0) {
      report += `**Suggested Improvements:**\n`;
      comp.suggestedImprovements.forEach((imp) => {
        report += `- ${imp}\n`;
      });
      report += `\n`;
    }

    if (comp.researchQueries.length > 0) {
      report += `**Research Queries:**\n`;
      comp.researchQueries.forEach((query) => {
        report += `- ${query}\n`;
      });
      report += `\n`;
    }

    report += `---\n\n`;
  });

  // Research Papers
  if (research.size > 0) {
    report += `## Research Papers\n\n`;
    Array.from(research.entries()).forEach(([componentName, papers]) => {
      report += `### ${componentName}\n\n`;
      papers.slice(0, 5).forEach((paper) => {
        report += `**${paper.title}**\n`;
        report += `- Authors: ${paper.authors.slice(0, 3).join('')}\n`;
        report += `- Year: ${paper.year}\n`;
        report += `- Citations: ${paper.citations}\n`;
        report += `- Relevance: ${(paper.relevanceScore * 100).toFixed(0)}%\n`;
        report += `- URL: ${paper.scholarUrl}\n`;
        if (paper.pdfUrl) {
          report += `- PDF: ${paper.pdfUrl}\n`;
        }
        report += `\n${paper.abstract}\n\n`;
        report += `---\n\n`;
      });
    });
  }

  return report;
}


