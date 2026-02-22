import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card as MuiCard,
  CardContent,
  CardHeader,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Alert,
  Container,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Send,
  Check,
  Link as LinkIcon,
  Analytics,
  Refresh,
  AddCircle as Add,
  Edit,
  Visibility,
  CheckCircle,
  Warning,
  Error,
  Delete,
  Notifications,
  Assessment,
  FileDownload,
  Email,
  Google,
  Language,
  Speed as Speed,
  Description,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`seo-tabpanel-${index}`}
      aria-labelledby={`seo-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function MarketingSEODashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [addKeywordOpen, setAddKeywordOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [crawlResultsOpen, setCrawlResultsOpen] = useState(false);
  const [schemaValidationOpen, setSchemaValidationOpen] = useState(false);
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [trendingKeywordsOpen, setTrendingKeywordsOpen] = useState(false);
  const [trendingKeywords, setTrendingKeywords] = useState<any[]>([]);
  const [newKeyword, setNewKeyword] = useState({
    keyword: ',',
    position: 99,
    searchVolume:  0,
    difficulty:  0,
    trend: 'stable',
    url: '',
    cpc: '',
    competitionLevel: '',
});
  const [newPage, setNewPage] = useState({
    url: '',
    title: '',
    metaDescription: '',
    keywords: '',
    status: 'pending',
});

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // SEO data queries
  const { data: keywords = [], isLoading: keywordsLoading } = useQuery({
    queryKey: ['/api/seo/keywords', ],
});

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ['/api/seo/pages', ],
});

  const { data: backlinks = [], isLoading: backlinksLoading } = useQuery({
    queryKey: ['/api/seo/backlinks'],
  });

  const { data: crawlData, isLoading: crawlLoading } = useQuery({
    queryKey: ['/api/seo/crawl-results'],
    enabled: false, // Manual trigger only
  });

  const { data: schemaData, isLoading: schemaLoading } = useQuery({
    queryKey: ['/api/seo/schema-validation'],
  });

  const { data: technicalSEO, isLoading: technicalLoading } = useQuery({
    queryKey: ['/api/seo/technical-analysis'],
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/seo-specialist/specialists/1/trends'],
    enabled: false, // Manual trigger
  });

  const { data: researchStats } = useQuery({
    queryKey: ['/api/seo/research/stats'],
  });

  // Mutations
  const addKeywordMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/seo/keywords','POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/keywords', ],});
      setAddKeywordOpen(false);
      setNewKeyword({
        keyword: '',
        position: 99,
        searchVolume:  0,
        difficulty:  0,
        trend: 'stable',
        url: '',
        cpc: '',
        competitionLevel: '',
    });
  },
});

  const addPageMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/seo/pages','POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/pages', ],});
      setAddPageOpen(false);
      setNewPage({
        url: '',
        title: '',
        metaDescription: ', ',
        keywords: '',
        status: 'pending',
    });
  },
});

  const syncSEODataMutation = useMutation({
    mutationFn: () => apiRequest('/api/seo/sync-data','POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/keywords', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/seo/backlinks', ],});
  },
});

  const syncAnalyticsMutation = useMutation({
    mutationFn: () => apiRequest('/api/seo/sync-analytics','POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/pages', ],});
  },
});

  const indexPageMutation = useMutation({
    mutationFn: (url: string) => apiRequest('/api/seo/index-page','POST', { url }),
  });

  const startCrawlMutation = useMutation({
    mutationFn: (url: string) => apiRequest('/api/seo/start-crawl','POST', { url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/crawl-results'] });
      setCrawlResultsOpen(true);
    },
  });

  const bulkIndexMutation = useMutation({
    mutationFn: () => apiRequest('/api/seo/bulk-index-pages','POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/pages'] });
    },
  });

  const bulkImportKeywordsMutation = useMutation({
    mutationFn: (keywords: string) => apiRequest('/api/seo/bulk-import-keywords','POST', { keywords }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/keywords'] });
      setBulkImportOpen(false);
      setBulkKeywords('');
    },
  });

  const validateSchemaMutation = useMutation({
    mutationFn: (url: string) => apiRequest('/api/seo/validate-schema','POST', { url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/schema-validation'] });
    },
  });

  // Calculate stats
  const totalKeywords = keywords.length;
  const avgPosition =
    keywords.length > 0
      ? Math.round(keywords.reduce((sum: number, k: any) => sum + k.position, 0) / keywords.length)
      : 0;
  const indexedPages = pages.filter((p: any) => p.status === 'indexed').length;
  const totalBacklinks = backlinks.length;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  const handleAddKeyword = () => {
    const keywordData = {
      ...newKeyword,
      cpc: parseFloat(newKeyword.cpc),
    };
    addKeywordMutation.mutate(keywordData);
  };

  const handleAddPage = () => {
    const pageData = {
      ...newPage,
      keywords: newPage.keywords
        .split(', ')
        .map((k) => k.trim())
        .filter((k) => k),
    };
    addPageMutation.mutate(pageData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'indexed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
}
};

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="success" />;
      case 'down':
        return <TrendingDown color="error" />;
      default:
        return <TrendingUp color="disabled" />;
}
};

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f8f9fa',
        p:  3}}
    >
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ 
              color: theming.colors.primary,
              fontWeight: 700,
              mb: 1
            }}
          >
            SEO & Marketing Dashboard - CreatorHubn.com
          </Typography>
          {researchStats?.stats?.loaded && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip 
                icon={<CheckCircle />}
                label={`🎓 Powered by ${researchStats.stats.totalPapers} Google Scholar Research Papers`}
                color="success"
                size="small"
              />
              <Chip 
                label="AI-Enhanced Insights"
                color="primary"
                size="small"
                variant="outlined"
              />
            </Box>
          )}
        </Box>

        {/* SEO Overview Cards - CoreUI Style */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MuiCard
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius:  3,
                boxShadow: '0 4px 25px rgba(12, 126, 234, 0.25)',
                transition: 'all 0.3s ease','&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 8px 35px rgba(12, 126, 234, 0.35)',
              }}}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'}}
                >
                  <Box>
                    <Typography
                      sx={{
                        opacity: 0.8,
                        fontSize: '0.875rem',
                        fontWeight: 5}}
                      gutterBottom
                    >
                      Total Nøkkelord
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {totalKeywords.toLocaleString()}
                    </Typography>
                    <Typography sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      +8.2% fra forrige uke
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: 'rgba(25,255,255,0.15)',
                      borderRadius:  2,
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <Search sx={{ fontSize: 36}} />
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MuiCard
              sx={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                borderRadius:  3,
                boxShadow: '0 4px 25px rgba(20, 147, 251, 0.25)',
                transition: 'all 0.3s ease','&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 8px 35px rgba(20, 147, 251, 0.35)',
              }}}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'}}
                >
                  <Box>
                    <Typography
                      sx={{
                        opacity: 0.8,
                        fontSize: '0.875rem',
                        fontWeight: 5}}
                      gutterBottom
                    >
                      Gjennomsnitt Posisjon
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                      #{avgPosition}
                    </Typography>
                    <Typography sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      -2.1 siden forrige måned
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: 'rgba(25,255,255,0.15)',
                      borderRadius:  2,
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <Analytics sx={{ fontSize: 36}} />
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MuiCard
              sx={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                borderRadius:  3,
                boxShadow: '0 4px 25px rgba(9, 172, 254, 0.25)',
                transition: 'all 0.3s ease','&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 8px 35px rgba(9, 172, 254, 0.35)',
              }}}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'}}
                >
                  <Box>
                    <Typography
                      sx={{
                        opacity: 0.8,
                        fontSize: '0.875rem',
                        fontWeight: 5}}
                      gutterBottom
                    >
                      Indekserte Sider
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {indexedPages.toLocaleString()}
                    </Typography>
                    <Typography sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      +15 nye denne uken
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: 'rgba(25,255,255,0.15)',
                      borderRadius:  2,
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <Visibility sx={{ fontSize: 36}} />
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MuiCard
              sx={{
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                color: 'white',
                borderRadius:  3,
                boxShadow: '0 4px 25px rgba(20, 112, 154, 0.25)',
                transition: 'all 0.3s ease', '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 8px 35px rgba(20, 112, 154, 0.35)',
              }}}
            >
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'}}
                >
                  <Box>
                    <Typography
                      sx={{
                        opacity: 0.8,
                        fontSize: '0.875rem',
                        fontWeight: 5}}
                      gutterBottom
                    >
                      Totale Backlinks
                    </Typography>
                    <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {totalBacklinks.toLocaleString()}
                    </Typography>
                    <Typography sx={{ opacity: 0.7, fontSize: '0.75rem' }}>
                      +24 nye denne måneden
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: 'rgba(25,255,255,0.15)',
                      borderRadius:  2,
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <LinkIcon sx={{ fontSize: 36}} />
                  </Box>
                </Box>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>

        {/* Google Indexing Quick Actions */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <MuiCard>
              <CardHeader 
                title="Google Indeksering"
                subheader="Send sider til Google for rask indeksering - optimalisert for norske søkeord"
                avatar={<Search color="primary" />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      label="URL for indeksering"
                      placeholder="https: //creatorhubn.com/fotograf"
                      sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap'}}>
                      <Button variant="contained" startIcon={<Send />}>
                        Send til Google
                      </Button>
                      <Button variant="outlined" startIcon={<Analytics />}>
                        Analyser SEO Score
                      </Button>
                      <Button 
                        variant="contained"
                        color="success"
                        startIcon={<Search />}
                        sx={{ minWidth: 200 }}
                        onClick={() => {
                          fetch('/api/seo/index-all-pages', { method: 'POST',})
                            .then((res) => res.json())
                            .then((data) => {
                              console.log('Alle sider sendt for indeksering: ', data);
                              alert(
                                `✅ ${data.totalPages} sider sendt til Google for indeksering!\nEstimert tid: ${data.estimatedFullIndexing}`,
                              );
                          })
                            .catch((err) => {
                              console.error('Indekseringsfeil:', err);
                              alert('Feil ved sending av sider til Google');
                          });
                      }}
                      >
                        Indekser Alle Sider
                      </Button>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        Rask Indeksering:
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        • URLs med norske nøkkelord: 12-24 timer
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        • Mobile-optimaliserte sider: Prioritet
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        • SEO score 80+: Høy prioritet
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 1, fontWeight: 'bold'}}
                      >
                        📄 Sitemap: {', '}
                        <a href="/sitemap.xml" target="_blank" style={{ color: '#1976d2'}}>
                          creatorhubn.com/sitemap.xml
                        </a>
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>

        {/* Sync Actions */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item>
            <Button 
              variant="contained"
              startIcon={<Refresh />}
              onClick={() => syncSEODataMutation.mutate()}
              disabled={syncSEODataMutation.isPending}
            >
              Oppdater SEO Data
            </Button>
          </Grid>
          <Grid item>
            <Button 
              variant="contained"
              startIcon={<Analytics />}
              onClick={() => syncAnalyticsMutation.mutate()}
              disabled={syncAnalyticsMutation.isPending}
            >
              Synkroniser Analytics
            </Button>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="SEO dashboard tabs">
          <Tab label="Nøkkelord" />
          <Tab label="Sider" />
          <Tab label="Backlinks" />
          <Tab label="Technical SEO" />
          <Tab label="Innholdsanalyse" />
            </Tabs>
          </Box>

          {/* Keywords Tab */}
          <TabPanel value={activeTab} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6">Nøkkelord Oversikt</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  variant="outlined"
                  size="small"
                  startIcon={<TrendingUp />}
                  onClick={async () => {
                    const response = await apiRequest('/api/seo-specialist/specialists/1/trends?profession=photographer&region=NO');
                    setTrendingKeywords(response.trendingKeywords || []);
                    setTrendingKeywordsOpen(true);
                  }}
                >
                  Google Trends
                </Button>
                <Button 
                  variant="outlined"
                  size="small"
                  onClick={() => setBulkImportOpen(true)}
                >
                  Bulk Import
                </Button>
                <Button 
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setAddKeywordOpen(true)}
                >
                  Legg til Nøkkelord
                </Button>
              </Box>
            </Box>

            {keywordsLoading ? (
              <LinearProgress />
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nøkkelord</TableCell>
                      <TableCell>Posisjon</TableCell>
                      <TableCell>Søkevolum</TableCell>
                      <TableCell>Vanskelighet</TableCell>
                      <TableCell>Trend</TableCell>
                      <TableCell>CPC</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {keywords.map((keyword: any) => (
                      <TableRow key={keyword.d}>
                        <TableCell>{keyword.keyword}</TableCell>
                        <TableCell>
                          <Chip
                            label={keyword.position}
                            color={
                              keyword.position <= 10
                                ? 'success'
                                : keyword.position <= 30
                                  ? 'warning'
                                  : 'default'
                          }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{keyword.searchVolume?.toLocaleString() || 0}</TableCell>
                        <TableCell>{keyword.difficulty || 0}%</TableCell>
                        <TableCell>{getTrendIcon(keyword.trend)}</TableCell>
                        <TableCell>{keyword.cpc ? `$${keyword.cpc}` : '-'}</TableCell>
                        <TableCell>
                          <IconButton size="small">
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Pages Tab */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6">Sider Oversikt</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  variant="outlined"
                  size="small"
                  onClick={() => bulkIndexMutation.mutate()}
                  disabled={bulkIndexMutation.isPending}
                >
                  Indekser Alle
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<Add />} 
                  onClick={() => setAddPageOpen(true)}
                >
                  Legg til Side
                </Button>
              </Box>
            </Box>

            {pagesLoading ? (
              <LinearProgress />
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>URL</TableCell>
                      <TableCell>Tittel</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>GA Visninger</TableCell>
                      <TableCell>SEO Score</TableCell>
                      <TableCell>Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pages.map((page: any) => (
                      <TableRow key={page.d}>
                        <TableCell>{page.url}</TableCell>
                        <TableCell>{page.title}</TableCell>
                        <TableCell>
                          <Chip
                            label={page.status}
                            color={getStatusColor(page.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{page.googleAnalyticsViews?.toLocaleString() || 0}</TableCell>
                        <TableCell>{page.seoScore || 0}</TableCell>
                        <TableCell>
                          <Tooltip title="Indekser side">
                            <IconButton
                              size="small"
                              onClick={() => indexPageMutation.mutate(page.url)}
                              disabled={indexPageMutation.isPending}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <IconButton size="small">
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Backlinks Tab */}
          <TabPanel value={activeTab} index={2}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Backlinks Oversikt
            </Typography>

            {backlinksLoading ? (
              <LinearProgress />
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Domene</TableCell>
                      <TableCell>URL</TableCell>
                      <TableCell>Anker Tekst</TableCell>
                      <TableCell>Domene Rating</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Trafikk Verdi</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {backlinks.map((backlink: any) => (
                      <TableRow key={backlink.d}>
                        <TableCell>{backlink.domain}</TableCell>
                        <TableCell>{backlink.url}</TableCell>
                        <TableCell>{backlink.anchorText || '-'}</TableCell>
                        <TableCell>{backlink.domainRating}</TableCell>
                        <TableCell>
                          <Chip
                            label={backlink.status}
                            color={backlink.status === 'active' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>${backlink.trafficValue || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* Technical SEO Tab */}
          <TabPanel value={activeTab} index={3}>
            <Typography variant="h6" gutterBottom>Technical SEO Analyse</Typography>
            
            {/* Core Web Vitals */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">Core Web Vitals</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <MuiCard>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">LCP (Largest Contentful Paint)</Typography>
                      <Typography variant="h4" color="success.main">1.8s</Typography>
                      <Typography variant="caption">God (&lt; 2.5s)</Typography>
                      <LinearProgress variant="determinate" value={72} color="success" sx={{ mt: 1 }} />
                    </CardContent>
                  </MuiCard>
                </Grid>
                <Grid item xs={12} md={4}>
                  <MuiCard>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">FID (First Input Delay)</Typography>
                      <Typography variant="h4" color="success.main">85ms</Typography>
                      <Typography variant="caption">God (under 100ms)</Typography>
                      <LinearProgress variant="determinate" value={85} color="success" sx={{ mt: 1 }} />
                    </CardContent>
                  </MuiCard>
                </Grid>
                <Grid item xs={12} md={4}>
                  <MuiCard>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">CLS (Cumulative Layout Shift)</Typography>
                      <Typography variant="h4" color="warning.main">0.12</Typography>
                      <Typography variant="caption">Trenger forbedring (under 0.1)</Typography>
                      <LinearProgress variant="determinate" value={60} color="warning" sx={{ mt: 1 }} />
                    </CardContent>
                  </MuiCard>
                </Grid>
              </Grid>
            </Box>

            {/* Technical Checks */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <MuiCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Robots.txt & Sitemap</Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="robots.txt funnet"
                          secondary="Korrekt konfigurert for crawling"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="XML Sitemap funnet"
                          secondary="178 URLs i sitemap"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="Sitemap sendt til Google"
                          secondary="Sist oppdatert: I dag"
                        />
                      </ListItem>
                    </List>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Button variant="outlined" size="small" fullWidth onClick={() => setCrawlResultsOpen(true)}>
                        Start Crawl
                      </Button>
                      <Button variant="outlined" size="small" fullWidth onClick={() => setSchemaValidationOpen(true)}>
                        Valider Schema
                      </Button>
                    </Box>
                  </CardContent>
                </MuiCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <MuiCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Mobile Usability</Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="Mobile-venlig design"
                          secondary="Responsiv på alle enheter"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="Touch-targets korrekt størrelse"
                          secondary="Minimum 48x48px"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><Warning color="warning" /></ListItemIcon>
                        <ListItemText 
                          primary="Font størrelse"
                          secondary="Noen tekster < 12px på mobil"
                        />
                      </ListItem>
                    </List>
                    <Button variant="outlined" size="small" fullWidth sx={{ mt: 2 }}>
                      Kjør Mobile Test
                    </Button>
                  </CardContent>
                </MuiCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <MuiCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>HTTPS & Security</Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="HTTPS aktivert"
                          secondary="Alle sider serveres over sikker tilkobling"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="SSL sertifikat gyldig"
                          secondary="Utløper: 15. Mars 2025"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="Ingen mixed content"
                          secondary="Alle ressurser lastes over HTTPS"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </MuiCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <MuiCard>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Structured Data</Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="Schema.org markup"
                          secondary="Organization, WebSite, BreadcrumbList"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                        <ListItemText 
                          primary="JSON-LD format"
                          secondary="Korrekt implementert"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><Warning color="warning" /></ListItemIcon>
                        <ListItemText 
                          primary="Rich Snippets"
                          secondary="Mangler på noen sider"
                        />
                      </ListItem>
                    </List>
                    <Button variant="outlined" size="small" fullWidth sx={{ mt: 2 }}>
                      Test Structured Data
                    </Button>
                  </CardContent>
                </MuiCard>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Content Analysis Tab */}
          <TabPanel value={activeTab} index={4}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>Innholdsanalyse</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">Lesbarhet Score</Typography>
                      <Typography variant="h4">72/100</Typography>
                      <LinearProgress variant="determinate" value={72} sx={{ mt: 1 }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">SEO Score</Typography>
                      <Typography variant="h4">85/100</Typography>
                      <LinearProgress variant="determinate" value={85} sx={{ mt: 1 }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">Engasjement</Typography>
                      <Typography variant="h4">3.2 min</Typography>
                      <Typography variant="caption" color="text.secondary">Avg. lesetid</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">AI Innholdsforslag</Typography>
                      <Chip label="Beta" size="small" color="primary" />
                    </Box>
                    <List>
                      <ListItem>
                        <ListItemIcon><TrendingUp /></ListItemIcon>
                        <ListItemText 
                          primary="Legg til flere H2 overskrifter"
                          secondary="Forbedrer struktur og SEO"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><TrendingUp /></ListItemIcon>
                        <ListItemText 
                          primary="Optimaliser metabeskrivelse"
                          secondary="Nåværende lengde: 98 tegn (anbefalt: 150-160)"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><TrendingUp /></ListItemIcon>
                        <ListItemText 
                          primary="Inkluder flere internlenker"
                          secondary="Kun 2 internlenker funnet"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Nøkkelord Densitet</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">digital markedsføring</Typography>
                        <Typography variant="body2" fontWeight="bold">2.4%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={48} />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">SEO optimalisering</Typography>
                        <Typography variant="body2" fontWeight="bold">1.8%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={36} />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">innholdsstrategi</Typography>
                        <Typography variant="body2" fontWeight="bold">1.2%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={24} />
                    </Box>
                    <Button variant="outlined" size="small" fullWidth sx={{ mt: 1 }}>
                      Analyser Flere Nøkkelord
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
      </Paper>

      {/* Reports & Analytics Section */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assessment /> Rapporter & Analyse
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Månedlig SEO Rapport</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Automatisk generert rapport med nøkkeltall og anbefalinger
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="contained" size="small" startIcon={<FileDownload />}>
                    Last ned PDF
                  </Button>
                  <Button variant="outlined" size="small">
                    Se Rapport
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Konkurranseanalyse</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Sammenlign din ytelse med konkurrentene
                </Typography>
                <Button variant="contained" size="small" fullWidth>
                  Generer Analyse
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Eksporter Data</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Last ned all SEO data i forskjellige formater
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                  <Button variant="outlined" size="small" startIcon={<FileDownload />}>
                    CSV Export
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<FileDownload />}>
                    Excel Export
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Planlagte Rapporter</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rapporttype</TableCell>
                  <TableCell>Frekvens</TableCell>
                  <TableCell>Neste Generering</TableCell>
                  <TableCell>Mottakere</TableCell>
                  <TableCell align="right">Handlinger</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>SEO Oversikt</TableCell>
                  <TableCell><Chip label="Ukentlig" size="small" /></TableCell>
                  <TableCell>15. Jan 2024</TableCell>
                  <TableCell>admin@bedrift.no</TableCell>
                  <TableCell align="right">
                    <IconButton size="small"><Edit /></IconButton>
                    <IconButton size="small"><Delete /></IconButton>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Nøkkelord Rapport</TableCell>
                  <TableCell><Chip label="Månedlig" size="small" /></TableCell>
                  <TableCell>1. Feb 2024</TableCell>
                  <TableCell>marketing@bedrift.no</TableCell>
                  <TableCell align="right">
                    <IconButton size="small"><Edit /></IconButton>
                    <IconButton size="small"><Delete /></IconButton>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <Button variant="outlined" sx={{ mt: 2 }} startIcon={<Add />}>
            Legg til Planlagt Rapport
          </Button>
        </Box>
      </Paper>

      {/* Monitoring & Alerts Section */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Notifications /> Overvåking & Varsler
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Aktive Varsler</Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon><Warning color="warning" /></ListItemIcon>
                    <ListItemText 
                      primary="Ranking Nedgang"
                      secondary="'digital markedsføring' falt 5 plasser"
                    />
                    <Chip label="I dag" size="small" color="warning" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><Error color="error" /></ListItemIcon>
                    <ListItemText 
                      primary="404 Feil Oppdaget"
                      secondary="3 nye 404-feil funnet ved crawl"
                    />
                    <Chip label="I går" size="small" color="error" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                    <ListItemText 
                      primary="Backlink Oppdaget"
                      secondary="Ny backlink fra høy DA side"
                    />
                    <Chip label="2 dager siden" size="small" color="success" />
                  </ListItem>
                </List>
                <Button variant="outlined" size="small" fullWidth sx={{ mt: 1 }}>
                  Se Alle Varsler
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Varslingsinnstillinger</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Ranking endringer" secondary="Varsle ved ±5 plasseringer" />
                    <Switch defaultChecked />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Nye backlinks" secondary="Daglig sammendrag" />
                    <Switch defaultChecked />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Tekniske feil" secondary="Umiddelbart varsel" />
                    <Switch defaultChecked />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Indekseringsstatus" secondary="Ukentlig rapport" />
                    <Switch />
                  </ListItem>
                </List>
                <Button variant="outlined" size="small" fullWidth sx={{ mt: 1 }}>
                  Konfigurer Varsler
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Integrasjoner</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Google />
                    <Typography variant="subtitle1">Google Analytics</Typography>
                  </Box>
                  <Chip label="Tilkoblet" color="success" size="small" />
                  <Button variant="outlined" size="small" fullWidth sx={{ mt: 2 }}>
                    Konfigurer
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Search />
                    <Typography variant="subtitle1">Search Console</Typography>
                  </Box>
                  <Chip label="Tilkoblet" color="success" size="small" />
                  <Button variant="outlined" size="small" fullWidth sx={{ mt: 2 }}>
                    Konfigurer
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Notifications />
                    <Typography variant="subtitle1">Slack</Typography>
                  </Box>
                  <Chip label="Ikke tilkoblet" size="small" />
                  <Button variant="contained" size="small" fullWidth sx={{ mt: 2 }}>
                    Koble til
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Email />
                    <Typography variant="subtitle1">E-post</Typography>
                  </Box>
                  <Chip label="Tilkoblet" color="success" size="small" />
                  <Button variant="outlined" size="small" fullWidth sx={{ mt: 2 }}>
                    Konfigurer
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Paper>
        {/* Add Keyword Dialog */}
        <Dialog
          open={addKeywordOpen}
          onClose={() => setAddKeywordOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Legg til Nytt Nøkkelord</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Nøkkelord"
                value={newKeyword.keyword}
                onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                fullWidth
              />
              <TextField
                label="Posisjon"
                type="number"
                value={newKeyword.position}
                onChange={(e) =>
                  setNewKeyword({
                    ...newKeyword,
                    position: parseInt(e.target.value) || 99,
                })
              }
                fullWidth
              />
              <TextField
                label="Søkevolum"
                type="number"
                value={newKeyword.searchVolume}
                onChange={(e) =>
                  setNewKeyword({
                    ...newKeyword,
                    searchVolume: parseInt(e.target.value) || 0,
                  })
                }
                fullWidth
              />
              <TextField
                label="URL"
                value={newKeyword.url}
                onChange={(e) => setNewKeyword({ ...newKeyword, url: e.target.value })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddKeywordOpen(false)}>Avbryt</Button>
            <Button 
              onClick={handleAddKeyword}
              variant="contained"
              disabled={addKeywordMutation.isPending}
            >
              Legg til
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add Page Dialog */}
        <Dialog open={addPageOpen} onClose={() => setAddPageOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Legg til Ny Side</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="URL"
                value={newPage.url}
                onChange={(e) => setNewPage({ ...newPage, url: e.target.value })}
                fullWidth
              />
              <TextField
                label="Tittel"
                value={newPage.title}
                onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                fullWidth
              />
              <TextField
                label="Meta Beskrivelse"
                multiline
                rows={3}
                value={newPage.metaDescription}
                onChange={(e) => setNewPage({ ...newPage, metaDescription: e.target.value })}
                fullWidth
              />
              <TextField
                label="Nøkkelord (komma-separert)"
                value={newPage.keywords}
                onChange={(e) => setNewPage({ ...newPage, keywords: e.target.value })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddPageOpen(false)}>Avbryt</Button>
            <Button 
              onClick={handleAddPage}
              variant="contained"
              disabled={addPageMutation.isPending}
            >
              Legg til
            </Button>
          </DialogActions>
        </Dialog>

        {/* Trending Keywords Dialog */}
        <Dialog 
          open={trendingKeywordsOpen} 
          onClose={() => setTrendingKeywordsOpen(false)} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="primary" />
            Google Trends - Trending Nøkkelord
          </DialogTitle>
          <DialogContent>
            {trendingKeywords.length === 0 ? (
              <Alert severity="info">Laster inn trenddata fra Google...</Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nøkkelord</TableCell>
                      <TableCell>Søkevolum</TableCell>
                      <TableCell>Trend</TableCell>
                      <TableCell align="right">Handling</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trendingKeywords.map((trend: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{trend.keyword}</TableCell>
                        <TableCell>
                          <Chip 
                            label={trend.formattedValue || trend.volume?.toLocaleString() || 'N/A'} 
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {trend.trend === 'up' ? (
                            <Chip icon={<TrendingUp />} label="Stigende" color="success" size="small" />
                          ) : trend.trend === 'down' ? (
                            <Chip icon={<TrendingDown />} label="Synkende" color="error" size="small" />
                          ) : (
                            <Chip label="Stabil" size="small" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setNewKeyword({
                                ...newKeyword,
                                keyword: trend.keyword,
                                searchVolume: trend.volume || 0,
                                trend: trend.trend ||'stable',
                              });
                              setTrendingKeywordsOpen(false);
                              setAddKeywordOpen(true);
                            }}
                          >
                            Legg til
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Alert severity="info" sx={{ mt: 2 }}>
              <strong>Tips:</strong> Disse nøkkelordene er hentet direkte fra Google Trends basert på din bransje og region (Norge).
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTrendingKeywordsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
