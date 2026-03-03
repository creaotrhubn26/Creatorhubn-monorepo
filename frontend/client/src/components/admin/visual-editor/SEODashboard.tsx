/**
 * SEO Dashboard Component
 * Comprehensive SEO analysis and optimization tools
 * Uses real API calls to server SEO service
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '../../../lib/queryClient';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  TextField,
  Chip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Badge,
  Avatar,
  Stack,
  Rating,
} from '@mui/material';
import {
  Search as SearchIcon,
  Analytics as AnalyticsIcon,
  Speed as SpeedIcon,
  Link as LinkIcon,
  ContentCopy as ContentCopyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
  BugReport as BugReportIcon,
  Schema as SchemaIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

// SEO Interfaces
interface SEOCrawlResult {
  totalPages: number;
  crawledPages: Record<string, unknown>[];
  issues: SEOIssue[];
  siteArchitecture: SiteArchitecture;
  performance: SitePerformance;
  contentAnalysis: ContentAnalysis;
  technicalSEO: TechnicalSEOAnalysis;
  lastCrawled: string; 
}

interface SEOIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'technical' | 'content' | 'performance' | 'accessibility' | 'structured-data';
  title: string;
  description: string;
  affectedPages: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixable: boolean;
  fixSuggestion?: string
}

interface SiteArchitecture {
  depth: number;
  orphanPages: string[];
  redirectChains: { from: string; to: string; chain: string[] }[];
  brokenLinks: { url: string; sourcePages: string[]; statusCode: number }[];
  internalLinking: { page: string; incomingLinks: number; outgoingLinks: number }[];
  sitemapIssues: { missing: string[]; orphan: string[]; invalid: string[] };
}

interface SitePerformance {
  averageLoadTime: number;
  slowPages: { url: string; loadTime: number }[];
  coreWebVitals: {
    lcp: { value: number; status: 'good' | 'needs-improvement' | 'poor' };
    fid: { value: number; status: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; status: 'good' | 'needs-improvement' | 'poor' };
  };
  mobileUsability: { issues: string[]; score: number };
}

interface ContentAnalysis {
  duplicateContent: { urls: string[]; similarity: number }[];
  titleIssues: { url: string; issue: string; current: string; suggested?: string }[];
  metaDescriptionIssues: { url: string; issue: string; current: string; suggested?: string }[];
  headingStructure: { url: string; issues: string[] }[];
  contentQuality: { url: string; score: number; issues: string[] }[];
  keywordDensity: { url: string; keywords: { word: string; density: number; count: number }[] }[];
}

interface TechnicalSEOAnalysis {
  robotsTxt: { valid: boolean; issues: string[]; directives: string[] };
  sitemaps: { found: string[]; valid: string[]; issues: string[] };
  canonicalIssues: { url: string; issue: string }[];
  hreflangIssues: { url: string; issue: string }[];
  schemaValidation: { valid: number; invalid: number; errors: string[] };
  mobileUsability: { issues: string[]; score: number };
  security: { https: boolean; issues: string[] };
}

interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  competition: 'low' | 'medium' | 'high';
  trends: { month: string; volume: number }[];
  relatedKeywords: string[];
  serpFeatures: string[]
}

interface CompetitorData {
  domain: string;
  authority: number;
  organicTraffic: number;
  keywords: number;
  backlinks: number;
  topPages: { url: string; title: string; traffic: number }[];
  topKeywords: { keyword: string; position: number; volume: number }[];
}

interface JSONLDSchema {
  id: string;
  type: string;
  schema: Record<string, unknown>;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
  pageUrl: string;
  lastValidated: string
}

interface SEODashboardProps {
  onCrawlClick?: () => void;
  onAnalyzeClick?: () => void;
  onKeywordsClick?: () => void;
  onCompetitorsClick?: () => void;
  onSchemaClick?: () => void;
  onReportsClick?: () => void;
  onSettingsClick?: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const toCompetition = (value: unknown): KeywordData['competition'] => {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'low';
};

const SEODashboard: React.FC<SEODashboardProps> = ({
  onCrawlClick,
  onAnalyzeClick,
  onKeywordsClick,
  onCompetitorsClick,
  onSchemaClick,
  onReportsClick,
  onSettingsClick
}) => {
  // State
  const [activeTab, setActiveTab] = useState(0);

  // Theming system
  const theming = useTheming('prototype_tester');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [crawlResult, setCrawlResult] = useState<SEOCrawlResult | null>(null);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [jsonLDSchemas, setJsonLDSchemas] = useState<JSONLDSchema[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<SEOIssue | null>(null);
  const [keywordSearchTerm, setKeywordSearchTerm] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  // Fetch initial data from APIs
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch existing keyword research data if available
        const keywordsResponse = await apiRequest('/api/seo/keywords/recent');
        if (keywordsResponse.success && keywordsResponse.keywords) {
          setKeywords(keywordsResponse.keywords);
        }

        // Fetch existing competitor data if available
        const competitorsResponse = await apiRequest('/api/seo/competitors/recent');
        if (competitorsResponse.success && competitorsResponse.competitors) {
          setCompetitors(competitorsResponse.competitors);
        }

        // Fetch JSON-LD schemas from recent crawls  
        const schemasResponse = await apiRequest('/api/seo/schemas/recent');
        if (schemasResponse.success && schemasResponse.schemas) {
          setJsonLDSchemas(schemasResponse.schemas);
        }
      } catch (err) {
        console.warn('No cached SEO data available, will fetch on demand');
      }
    };

    fetchInitialData();
  }, []);

  // Real keyword research API call
  const handleKeywordResearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm) return;

    try {
      setError(null);
      const response = await apiRequest('/api/seo/keywords/research', {
        method: 'POST',
        body: JSON.stringify({
          seed: searchTerm,
          userType: 'photographer',
          location: 'norway'
        })
      });

      if (response.success && Array.isArray(response.keywords)) {
        const mappedKeywords = response.keywords
          .filter(isRecord)
          .map((kw: Record<string, unknown>): KeywordData => {
            const trendValues: unknown[] = Array.isArray(kw.trends) ? kw.trends : [];
            return {
              keyword: toStringValue(kw.keyword),
              volume: toNumber(kw.searchVolume ?? kw.volume),
              difficulty: toNumber(kw.difficulty),
              cpc: toNumber(kw.cpc),
              competition: toCompetition(kw.competition),
              trends: trendValues.map((value: unknown, index: number) => ({
                month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index % 12],
                volume: toNumber(value)
              })),
              relatedKeywords: toStringArray(kw.relatedKeywords),
              serpFeatures: toStringArray(kw.serpFeatures)
            };
          })
          .filter((kw: KeywordData) => kw.keyword.length > 0);
        setKeywords(mappedKeywords);
        onKeywordsClick?.();
      }
    } catch (err) {
      setError('Failed to fetch keyword data. Please try again.');
      console.error('Keyword research error:', err);
    }
  }, [onKeywordsClick]);

  // Real competitor analysis API call
  const handleCompetitorAnalysis = useCallback(async (domain: string) => {
    if (!domain) return;

    try {
      setError(null);
      const response = await apiRequest('/api/seo/competitors/analyze', {
        method: 'POST',
        body: JSON.stringify({
          domain,
          userType: 'photographer'
        })
      });

      if (response.success && response.competitors) {
        setCompetitors(response.competitors.map((comp: Record<string, unknown>) => ({
          domain: comp.domain,
          authority: comp.domainAuthority || comp.authority,
          organicTraffic: comp.estimatedTraffic || comp.organicTraffic,
          keywords: comp.keywordsCount || comp.keywords,
          backlinks: comp.backlinksCount || comp.backlinks,
          topPages: comp.topPages || [],
          topKeywords: comp.topKeywords || []
        })));
        onCompetitorsClick?.();
      }
    } catch (err) {
      setError('Failed to analyze competitors. Please try again.');
      console.error('Competitor analysis error:', err);
    }
  }, [onCompetitorsClick]);

  // Real website crawl API call
  const handleCrawlWebsite = useCallback(async () => {
    if (!crawlUrl) return;

    setIsCrawling(true);
    setCrawlProgress(0);
    setError(null);

    try {
      // Start the crawl
      const startResponse = await apiRequest('/api/seo/crawl', {
        method: 'POST',
        body: JSON.stringify({
          url: crawlUrl,
          options: {
            maxPages: 1000,
            followRedirects: true,
            checkBrokenLinks: true,
            analyzeContent: true,
            validateStructuredData: true,
            checkMobileUsability: true,
            analyzePerformance: true
          }
        })
      });

      if (!startResponse.success) {
        throw new Error(startResponse.error || 'Failed to start crawl');
      }

      const crawlId = startResponse.crawlId;

      // Poll for crawl progress
      const pollProgress = async () => {
        try {
          const progressResponse = await apiRequest(`/api/seo/crawl/${crawlId}/status`);

          if (progressResponse.status === 'completed') {
            setCrawlProgress(100);
            setIsCrawling(false);

            // Fetch the complete crawl results
            const resultsResponse = await apiRequest(`/api/seo/crawl/${crawlId}/results`);

            if (resultsResponse.success) {
              setCrawlResult({
                totalPages: resultsResponse.totalPages || 0,
                crawledPages: resultsResponse.crawledPages || [],
                issues: (resultsResponse.issues || []).map((issue: Record<string, unknown>) => ({
                  id: issue.id || `issue-${Date.now()}`,
                  type: issue.type || 'warning',
                  category: issue.category || 'technical',
                  title: issue.title,
                  description: issue.description,
                  affectedPages: issue.affectedPages || [],
                  severity: issue.severity || 'medium',
                  fixable: issue.fixable ?? true,
                  fixSuggestion: issue.fixSuggestion
                })),
                siteArchitecture: resultsResponse.siteArchitecture || {
                  depth: 0,
                  orphanPages: [],
                  redirectChains: [],
                  brokenLinks: [],
                  internalLinking: [],
                  sitemapIssues: { missing: [], orphan: [], invalid: [] }
                },
                performance: resultsResponse.performance || {
                  averageLoadTime: 0,
                  slowPages: [],
                  coreWebVitals: {
                    lcp: { value: 0, status: 'good' },
                    fid: { value: 0, status: 'good' },
                    cls: { value: 0, status: 'good' }
                  },
                  mobileUsability: { issues: [], score: 0 }
                },
                contentAnalysis: resultsResponse.contentAnalysis || {
                  duplicateContent: [],
                  titleIssues: [],
                  metaDescriptionIssues: [],
                  headingStructure: [],
                  contentQuality: [],
                  keywordDensity: []
                },
                technicalSEO: resultsResponse.technicalSEO || {
                  robotsTxt: { valid: true, issues: [], directives: [] },
                  sitemaps: { found: [], valid: [], issues: [] },
                  canonicalIssues: [],
                  hreflangIssues: [],
                  schemaValidation: { valid: 0, invalid: 0, errors: [] },
                  mobileUsability: { issues: [], score: 0 },
                  security: { https: false, issues: [] }
                },
                lastCrawled: new Date().toISOString()
              });

              // Also update JSON-LD schemas from crawl results
              if (resultsResponse.schemas) {
                setJsonLDSchemas(resultsResponse.schemas);
              }
            }

            onCrawlClick?.();
            return;
          } else if (progressResponse.status === 'failed') {
            throw new Error(progressResponse.error || 'Crawl failed');
          } else {
            // Update progress
            setCrawlProgress(progressResponse.progress || 0);
            // Continue polling
            setTimeout(pollProgress, 2000);
          }
        } catch (pollError) {
          console.error('Progress poll error:', pollError);
          setIsCrawling(false);
          setError('Failed to get crawl progress');
        }
      };

      // Start polling
      pollProgress();

    } catch (err) {
      setIsCrawling(false);
      setError(err instanceof Error ? err.message : 'Failed to crawl website');
      console.error('Crawl error:', err);
    }
  }, [crawlUrl, onCrawlClick]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
}
};

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'info': return <InfoIcon color="info" />;
      default: return <InfoIcon />;
}
};

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
        <AnalyticsIcon color="primary" />
        Advanced SEO Dashboard
      </Typography>

      {/* Error Display */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Website Crawl" />
        <Tab label="Keyword Research" />
        <Tab label="Competitor Analysis" />
        <Tab label="Schema.org & JSON-LD" />
        <Tab label="Technical SEO" />
        <Tab label="Performance" />
        <Tab label="Reports" />
      </Tabs>

      {/* Website Crawl Tab */}
      {activeTab === 0 && (
        <Box>
          <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🕷️ Website Crawl
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <TextField
                  label="Website URL"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://example.com"
                  fullWidth
                  variant="outlined"
                />
                <Button
                  variant="contained"
                  onClick={handleCrawlWebsite}
                  disabled={!crawlUrl || isCrawling}
                  startIcon={<SearchIcon />}
                >
                  {isCrawling ? 'Crawling...' : 'Start Crawl'}
                </Button>
              </Box>
              
              {isCrawling && (
                <Box sx={{ mb:  2 }}>
                  <Typography variant="body2" gutterBottom>
                    Crawling website... {crawlProgress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={crawlProgress} />
                </Box>
              )}
            </CardContent>
          </Card>

          {crawlResult && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      📊 Crawl Summary
                    </Typography>
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {crawlResult.totalPages}
                      </Typography>
                      <Typography variant="body2">Pages Crawled</Typography>
                    </Box>
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="h4" color="error" sx={{ color: theming.colors.primary }}>
                        {crawlResult.issues.filter(i => i.severity === 'critical').length}
                      </Typography>
                      <Typography variant="body2">Critical Issues</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      ⚡ Performance
                    </Typography>
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {crawlResult.performance.averageLoadTime.toFixed(1)}s
                      </Typography>
                      <Typography variant="body2">Average Load Time</Typography>
                    </Box>
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="h4" color="warning" sx={{ color: theming.colors.primary }}>
                        {crawlResult.performance.slowPages.length}
                      </Typography>
                      <Typography variant="body2">Slow Pages</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      🔗 Site Architecture
                    </Typography>
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {crawlResult.siteArchitecture.depth}
                      </Typography>
                      <Typography variant="body2">Site Depth</Typography>
                    </Box>
                    <Box sx={{ mt:  2 }}>
                      <Typography variant="h4" color="error" sx={{ color: theming.colors.primary }}>
                        {crawlResult.siteArchitecture.brokenLinks.length}
                      </Typography>
                      <Typography variant="body2">Broken Links</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      🚨 SEO Issues Found
                    </Typography>
                    <List>
                      {crawlResult.issues.map((issue) => (
                        <ListItem key={issue.id} sx={{ borderBottom: 1, borderColor: 'divider'}}>
                          <ListItemIcon>
                            {getIssueIcon(issue.type)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                                <Typography variant="h6" sx={{ color: theming.colors.primary }}>{issue.title}</Typography>
                                <Chip 
                                  label={issue.severity}
                                  color={getSeverityColor(issue.severity) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                                  size="small"
                                />
                                <Chip 
                                  label={issue.category}
                                  variant="outlined"
                                  size="small"
                                />
                              </Box>
                          }
                            secondary={
                              <Box>
                                <Typography variant="body2" sx={{ mb:  1 }}>
                                  {issue.description}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Affected pages: {issue.affectedPages.length}
                                </Typography>
                                {issue.fixSuggestion && (
                                  <Alert severity="info" sx={{ mt:  1 }}>
                                    <Typography variant="body2">
                                      <strong>Fix suggestion: </strong> {issue.fixSuggestion}
                                    </Typography>
                                  </Alert>
                                )}
                              </Box>
                          }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {/* Keyword Research Tab */}
      {activeTab === 1 && (
        <Box>
          <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🔍 Keyword Research
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Search Keywords"
                  placeholder="web design, digital marketing"
                  fullWidth
                  variant="outlined"
                  value={keywordSearchTerm}
                  onChange={(e) => setKeywordSearchTerm(e.target.value)}
                />
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => handleKeywordResearch(keywordSearchTerm)}
                  disabled={!keywordSearchTerm}
                >
                  Research Keywords
                </Button>
              </Box>
            </CardContent>
          </Card>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Keyword</TableCell>
                  <TableCell>Volume</TableCell>
                  <TableCell>Difficulty</TableCell>
                  <TableCell>CPC</TableCell>
                  <TableCell>Competition</TableCell>
                  <TableCell>Trend</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {keywords.map((keyword) => (
                  <TableRow key={keyword.keyword}>
                    <TableCell>
                      <Typography variant="subtitle2">{keyword.keyword}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Related: {keyword.relatedKeywords.slice(0, 2).join(', ')}
                      </Typography>
                    </TableCell>
                    <TableCell>{keyword.volume.toLocaleString()}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Rating value={keyword.difficulty / 20} readOnly size="small" />
                        <Typography variant="body2">{keyword.difficulty}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>${keyword.cpc.toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip
                        label={keyword.competition}
                        color={keyword.competition === 'high' ? 'error' : keyword.competition === 'medium' ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TrendingUpIcon color="success" />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => navigator.clipboard.writeText(keyword.keyword)}>
                        <ContentCopyIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Competitor Analysis Tab */}
      {activeTab === 2 && (
        <Box>
          <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🏆 Competitor Analysis
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Competitor Domain"
                  placeholder="competitor.com"
                  fullWidth
                  variant="outlined"
                  value={competitorDomain}
                  onChange={(e) => setCompetitorDomain(e.target.value)}
                />
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => handleCompetitorAnalysis(competitorDomain)}
                  disabled={!competitorDomain}
                >
                  Analyze Competitor
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            {competitors.map((competitor) => (
              <Grid item xs={12} md={6} key={competitor.domain}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {competitor.domain.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{competitor.domain}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Domain Authority: {competitor.authority}
                        </Typography>
                      </Box>
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                          {competitor.organicTraffic.toLocaleString()}
                        </Typography>
                        <Typography variant="body2">Organic Traffic</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                          {competitor.keywords.toLocaleString()}
                        </Typography>
                        <Typography variant="body2">Keywords</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                          {competitor.backlinks.toLocaleString()}
                        </Typography>
                        <Typography variant="body2">Backlinks</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Rating value={competitor.authority / 20} readOnly />
                        <Typography variant="body2">Authority Score</Typography>
                      </Grid>
                    </Grid>

                    <Typography variant="subtitle2" gutterBottom>
                      Top Pages:
                    </Typography>
                    <List dense>
                      {competitor.topPages.slice(0, 3).map((page, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={page.title}
                            secondary={`${page.traffic.toLocaleString()} traffic`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Schema.org & JSON-LD Tab */}
      {activeTab === 3 && (
        <Box>
          <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📋 Schema.org & JSON-LD Validation
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  label="Page URL"
                  placeholder="https://example.com/page"
                  fullWidth
                  variant="outlined"
                />
                <Button variant="contained" startIcon={<SchemaIcon />}>
                  Validate Schema
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                    📊 Schema Summary
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h4" color="success.main">
                      {jsonLDSchemas.filter(s => s.validation.valid).length}
                    </Typography>
                    <Typography variant="body2">Valid Schemas</Typography>
                  </Box>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h4" color="error.main">
                      {jsonLDSchemas.filter(s => !s.validation.valid).length}
                    </Typography>
                    <Typography variant="body2">Invalid Schemas</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <List>
                {jsonLDSchemas.map((schema) => (
                  <Accordion key={schema.id}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        {schema.validation.valid ? (
                          <CheckCircleIcon color="success" />
                        ) : (
                          <ErrorIcon color="error" />
                        )}
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{schema.type}</Typography>
                        <Chip
                          label={schema.validation.valid ? 'Valid' : 'Invalid'}
                          color={schema.validation.valid ? 'success' : 'error'}
                          size="small"
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Schema Data:
                        </Typography>
                        <Paper sx={{ p: 2, bgcolor: 'grey.50', ...theming.getThemedCardSx() }}>
                          <Box component="pre" sx={{ fontSize: '12px', overflow:'auto', m: 0 }}>
                            {JSON.stringify(schema.schema, null, 2)}
                          </Box>
                        </Paper>
                      </Box>

                      {schema.validation.errors.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom color="error">
                            Errors:
                          </Typography>
                          {schema.validation.errors.map((err, index) => (
                            <Alert key={index} severity="error" sx={{ mb: 1 }}>
                              {err}
                            </Alert>
                          ))}
                        </Box>
                      )}

                      {schema.validation.warnings.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom color="warning.main">
                            Warnings:
                          </Typography>
                          {schema.validation.warnings.map((warning, index) => (
                            <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                              {warning}
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </List>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Quick Actions */}
      <Card sx={{ mt: 3, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            🚀 Quick Actions
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button variant="outlined" startIcon={<SearchIcon />} onClick={onCrawlClick}>
              Full Site Crawl
            </Button>
            <Button variant="outlined" startIcon={<AnalyticsIcon />} onClick={onAnalyzeClick}>
              SEO Analysis
            </Button>
            <Button variant="outlined" startIcon={<TrendingUpIcon />} onClick={onKeywordsClick}>
              Keyword Research
            </Button>
            <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={onCompetitorsClick}>
              Competitor Analysis
            </Button>
            <Button variant="outlined" startIcon={<SchemaIcon />} onClick={onSchemaClick}>
              Schema Validation
            </Button>
            <Button variant="outlined" startIcon={<AssessmentIcon />} onClick={onReportsClick}>
              Generate Report
            </Button>
            <Button variant="outlined" startIcon={<SettingsIcon />} onClick={onSettingsClick}>
              SEO Settings
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SEODashboard;
