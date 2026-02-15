/**
 * SEO Tools Panel Component
 * Extracted from CreatorhubVisualEditor.tsx to organized component structure
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useEnhancedMasterIntegration } from '../../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../../utils/theming-helper';
import { apiRequest } from '../../../lib/queryClient';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Button,
  ButtonGroup,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Grid,
  Paper
} from '@mui/material';
import {
  Analytics,
  Language
} from '@mui/icons-material';

interface SEOToolsPanelProps {
  selectedProject?: { id: string; name?: string };
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  onNotificationCreate?: (notification: Record<string, unknown>) => void; 
}

export const SEOToolsPanel: React.FC<SEOToolsPanelProps> = ({
  selectedProject,
  onProjectUpdate,
  onNotificationCreate,
}) => {
  const { analytics, lifecycle, performance, debugging, auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  
  // SEO Tools State
  const [crawlUrl, setCrawlUrl] = useState('');

  // Component registration and performance monitoring
  useEffect(() => {
    const endTiming = performance.startTiming('seo_tools_panel_render');

    lifecycle.registerComponent({
      id: 'SEOToolsPanel',
      type: 'seo-tools-panel',
      version: '1.0.0',
      capabilities: {
        data: ['seo:analyze','crawl:execute','competitor:analyze','keyword:research'],
        events: ['seo:analysis:complete','crawl:finished','competitor:analyzed'],
        actions: ['seo:analyze','crawl:start','competitor:analyze','keyword:research'],
        ui: ['seo:display','crawl:interface','analysis:results'],
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

    analytics.trackEvent('seo_tools_panel_mounted', {
      componentId: 'SEOToolsPanel',
      projectId: selectedProject?.id,
      timestamp: Date.now(),
    });

    debugging.logIntegration('info', 'SEOToolsPanel component mounted', {
      componentId: 'SEOToolsPanel',
      projectId: selectedProject?.id,
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('SEOToolsPanel');
      analytics.trackEvent('seo_tools_panel_unmounted', {
        componentId: 'SEOToolsPanel',
        timestamp: Date.now(),
      });
    };
  }, [analytics, lifecycle, performance, debugging, selectedProject?.id]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [isAnalyzingCompetitor, setIsAnalyzingCompetitor] = useState(false);
  const [seedKeyword, setSeedKeyword] = useState('');
  const [isResearchingKeywords, setIsResearchingKeywords] = useState(false);
  const [keywordResearch, setKeywordResearch] = useState<Record<string, unknown> | null>(null);
  const [jsonLDData, setJsonLDData] = useState<Record<string, unknown> | null>(null);
  const [isGeneratingJSONLD, setIsGeneratingJSONLD] = useState(false);

  // SEO Crawl Functions  
  const crawlWebsite = useCallback(async (url: string) => {
    if (!url) return;
    
    setIsCrawling(true);
    setCrawlProgress(0);

    try {
      const headers = await auth.getAuthHeader();
      const crawlResult = await apiRequest('/api/seo/crawl', {
        headers: {
          ...headers,
          "Content-Type" : "application/json",
        },
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setCrawlProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      // Await comprehensive crawling
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsCrawling(false);
      setCrawlProgress(0);

      onNotificationCreate?.({
        id: `seo_crawl_${Date.now()}`,
        type: 'seo_audit',
        title: 'SEO Crawl Completed',
        message: `Analyzed ${crawlResult.totalPages} pages`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'seo-crawl',
      });

      return crawlResult;
    } catch (error) {
      setIsCrawling(false);
      setCrawlProgress(0);
      console.error('SEO crawl failed:', error);
    }
  }, [onNotificationCreate, auth]);

  // Competitor Analysis Function
  const analyzeCompetitor = useCallback(async () => {
    if (!competitorUrl) return;

    setIsAnalyzingCompetitor(true);

    try {
      const headers = await auth.getAuthHeader();
      const competitorData = await apiRequest('/api/seo/competitor/analyze', {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ 
          url: competitorUrl,
          projectId: selectedProject?.id,
        }),
      });

      onNotificationCreate?.({
        id: `competitor_analysis_${Date.now()}`,
        type: 'seo_audit',
        title: 'Competitor Analysis Completed',
        message: `Analyzed ${competitorUrl}`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'competitor-analysis',
      });

      debugging.logIntegration('info', 'Competitor analysis completed', {
        url: competitorUrl,
        projectId: selectedProject?.id,
        resultsCount: competitorData?.metrics?.length || 0,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Competitor analysis failed';
      debugging.logIntegration('error', 'Competitor analysis failed', {
        url: competitorUrl,
        error: errorMessage,
      });
      console.error('Competitor analysis failed:', error);
    } finally {
      setIsAnalyzingCompetitor(false);
    }
  }, [competitorUrl, selectedProject?.id, auth, onNotificationCreate, debugging]);

  // JSON-LD Generation Function
  const generateJsonLD = useCallback(async (schemaType: 'organization' | 'website' | 'breadcrumb') => {
    if (!selectedProject) return;

    setIsGeneratingJSONLD(true);

    try {
      const headers = await auth.getAuthHeader();
      const jsonldResult = await apiRequest('/api/seo/jsonld/generate', {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProject.id,
          schemaType,
          projectData: {
            name: selectedProject.name,
            url: selectedProject.url,
            description: selectedProject.description,
          },
        }),
      });

      setJsonLDData(jsonldResult);

      onNotificationCreate?.({
        id: `jsonld_generated_${Date.now()}`,
        type: 'seo_audit',
        title: 'JSON-LD Generated',
        message: `Generated ${schemaType} structured data`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'jsonld-generator',
      });

      analytics.trackEvent('jsonld_generated', {
        schemaType,
        projectId: selectedProject.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'JSON-LD generation failed';
      console.error('JSON-LD generation failed:', error);
      onNotificationCreate?.({
        id: `jsonld_error_${Date.now()}`,
        type: 'error',
        title: 'JSON-LD Generation Failed',
        message: errorMessage,
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'jsonld-generator',
      });
    } finally {
      setIsGeneratingJSONLD(false);
    }
  }, [selectedProject, auth, onNotificationCreate, analytics]);

  // Keyword Research Functions
  const researchKeywords = useCallback(async (researchType: 'related' | 'longtail' | 'suggestions') => {
    if (!seedKeyword) return;

    setIsResearchingKeywords(true);

    try {
      const headers = await auth.getAuthHeader();
      // Simulate keyword research API call
      const keywordResults = await apiRequest('/api/seo/keywords/research', {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          seedKeyword,
          researchType,
          options: {
            language: 'no',
            country: 'NO',
            maxResults: 100,
          },
        }),
      });

      setKeywordResearch({
        type: researchType,
        seedKeyword,
        keywords: keywordResults.keywords,
        suggestions: keywordResults.suggestions,
        timestamp: new Date().toISOString(),
      });

      onNotificationCreate?.({
        id: `keyword_research_${Date.now()}`,
        type: 'seo_audit',
        title: 'Keyword Research Completed',
        message: `Found ${keywordResults.keywords?.length || 0} keywords for "${seedKeyword}"`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'keyword-research',
      });
    } catch (error) {
      console.error('Keyword research failed:', error);
    } finally {
      setIsResearchingKeywords(false);
    }
  }, [seedKeyword, onProjectUpdate, selectedProject, onNotificationCreate, auth]);

  return (
    <Paper sx={{ ...theming.getThemedCardSx(), p: 3, m: 2 }}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        <Analytics color="primary" />
        SEO Tools
      </Typography>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('assessment')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>SEO Crawl</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField 
              fullWidth 
              placeholder="Enter website URL"
              value={crawlUrl}
              onChange={(e) => setCrawlUrl(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={theming.getThemedIcon('search')}
              onClick={() => crawlWebsite(crawlUrl)}
              disabled={isCrawling || !crawlUrl}
              sx={theming.getThemedButtonSx()}
            >
              {isCrawling ? 'Crawling...' : 'Crawl Website'}
            </Button>
          </Box>

          {isCrawling && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={crawlProgress}
              />
              <Typography variant="caption" display="block">
                Crawl Progress: {crawlProgress}%
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            <Language />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Keyword Research</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                placeholder="Enter seed keyword"
                value={seedKeyword}
                onChange={(e) => setSeedKeyword(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <ButtonGroup fullWidth>
                <Button 
                  variant="outlined"
                  onClick={() => researchKeywords('related')}
                  disabled={isResearchingKeywords || !seedKeyword}
                >
                  Related
                </Button>
                <Button 
                  variant="outlined"
                  onClick={() => researchKeywords('longtail')}
                  disabled={isResearchingKeywords || !seedKeyword}
                >
                  Long-tail
                </Button>
                <Button 
                  variant="outlined"
                  onClick={() => researchKeywords('suggestions')}
                  disabled={isResearchingKeywords || !seedKeyword}
                >
                  Suggestions
                </Button>
              </ButtonGroup>
            </Grid>
          </Grid>

          {keywordResearch && (
            <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Results for "{keywordResearch.seedKeyword}"
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {keywordResearch.keywords?.slice(0, 10).map((keyword: string, index: number) => (
                  <Chip
                    key={index}
                    label={keyword}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Paper>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('business')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Competitor Analysis</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info" sx={{ mb: 2 }}>
            Analyze your competitors' SEO performance to identify opportunities and benchmarks for your site.
          </Alert>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField 
              fullWidth 
              placeholder="Enter competitor website URL"
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              disabled={isAnalyzingCompetitor}
            />
            <Button
              variant="contained"
              startIcon={isAnalyzingCompetitor ? <CircularProgress size={20} /> : theming.getThemedIcon('analyze')}
              onClick={analyzeCompetitor}
              disabled={isAnalyzingCompetitor || !competitorUrl}
              sx={theming.getThemedButtonSx()}
            >
              {isAnalyzingCompetitor ? 'Analyzing...' : 'Analyze'}
            </Button>
          </Box>

          {isAnalyzingCompetitor && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2">Analyzing competitor data...</Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('storage')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Structured Data</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {isGeneratingJSONLD ? 'Generating JSON-LD schema...' : 'Generate structured data markup for search engines.'}
          </Alert>
          <ButtonGroup sx={{ mb: 2 }}>
            <Button 
              variant="outlined"
              onClick={() => generateJsonLD('organization')}
              disabled={isGeneratingJSONLD || !selectedProject}
              startIcon={isGeneratingJSONLD ? <CircularProgress size={16} /> : undefined}
            >
              Organization
            </Button>
            <Button 
              variant="outlined"
              onClick={() => generateJsonLD('website')}
              disabled={isGeneratingJSONLD || !selectedProject}
              startIcon={isGeneratingJSONLD ? <CircularProgress size={16} /> : undefined}
            >
              Website
            </Button>
            <Button 
              variant="outlined"
              onClick={() => generateJsonLD('breadcrumb')}
              disabled={isGeneratingJSONLD || !selectedProject}
              startIcon={isGeneratingJSONLD ? <CircularProgress size={16} /> : undefined}
            >
              Breadcrumb
            </Button>
          </ButtonGroup>

          {jsonLDData && (
            <TableContainer component={Paper} sx={{ ...theming.getThemedCardSx(), mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: theming.colors.surface }}>
                    <TableCell>Property</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(jsonLDData).map(([key, value]: [string, unknown], index: number) => (
                    <TableRow key={index} hover>
                      <TableCell sx={{ fontWeight: 500 }}>{key}</TableCell>
                      <TableCell>
                        {typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : String(value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {jsonLDData && (
            <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Raw JSON-LD</Typography>
              <Box
                component="pre"
                sx={{
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: '200px',
                  backgroundColor: '#f5f5f0',
                  padding: '12px',
                  borderRadius:'4px'}}
              >
                {JSON.stringify(jsonLDData, null, 2)}
              </Box>
            </Paper>
          )}
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Box display="flex" alignItems="center" gap={1}>
            <Language />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Keyword Research</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography color="text.secondary">Keyword research tools coming soon.</Typography>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};
