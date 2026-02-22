import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
} from '@mui/material';
import {
  Article,
  TrendingUp,
  Search,
  CalendarToday as CalendarTodayToday,
  Analytics,
  Create,
  Publish,
  ExpandMore,
  KeyboardArrowRight,
  Visibility,
  ThumbUp,
  Share,
  Comment,
  Star,
  Schedule,
  Language,
  LocationOn,
  Business as DirectionsBusiness,
  CameraAlt,
  VideoLibrary as VideocamLibrary,
  MusicNote as MusicNoteNote,
  Edit,
  Delete,
  Preview,
  Add,
  ContentCopy as ContentContentCopy,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'scheduled' | 'published';
  publishDate: string;
  tags: string[];
  category: string;
  profession: string;
  seoScore: number;
  readingTime: number;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  targetKeywords: string[];
  metaDescription: string;
  socialPreview: {
    title: string;
    description: string;
    image: string;
};
}

interface SEOKeyword {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  relevance: number;
  trend: 'up' | 'down' | 'stable';
  suggestions: string[]
}

interface ContentTemplate {
  id: string;
  name: string;
  profession: string;
  category: string;
  template: string;
  variables: string[];
  seoTips: string[]
}

interface ContentCalendarEvent {
  id: string;
  title: string;
  type: 'blog' | 'social' | 'email' | 'video';
  date: string;
  status: 'planned' | 'in-progress' | 'completed';
  assignedTo: string;
  notes: string
}

interface ContentMarketingEngineProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

const ContentMarketingEngine: React.FC<ContentMarketingEngineProps> = ({ 
  profession = 'photographer' 
}) => {
  const [tabValue, setTabValue] = useState(false);
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [keywords, setKeywords] = useState<SEOKeyword[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<ContentCalendarEvent[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<any[]>([]);
  const [contentSuggestions, setContentSuggestions] = useState<any[]>([]);
  const [selectedTrend, setSelectedTrend] = useState<any>(null);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'create' | 'edit' | 'keyword' | 'template'>('create',
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProfession, setFilterProfession] = useState('all,');
  const [newPost, setNewPost] = useState<Partial<BlogPost>>({
    title: '',
    content: '',
    excerpt: '',
    status: 'draft',
    tags:  [],
    category: '',
    profession: 'photographer',
    targetKeywords:  [],
    metaDescription: '',
});

  // Load data on component mount
  useEffect(() => {
    loadContentData();
}, []);

  const loadContentData = async () => {
    setLoading(true);
    try {
      const [postsRes, keywordsRes, templatesRes, calendarRes, trendsRes, suggestionsRes] =
        await Promise.all([
          fetch('/api/content-marketing/posts,'),
          fetch('/api/content-marketing/keywords'),
          fetch('/api/content-marketing/templates'),
          fetch('/api/content-marketing/calendar'),
          fetch('/api/content-marketing/trends/topics'),
          fetch('/api/content-marketing/trends/content-suggestions?profession=' + filterProfession),
        ]);

      const [posts, keywordData, templateData, calendarData, trendsData, suggestionsData] =
        await Promise.all([
          postsRes.json(),
          keywordsRes.json(),
          templatesRes.json(),
          calendarRes.json(),
          trendsRes.json(),
          suggestionsRes.json(),
        ]);

      setBlogPosts(posts.data || []);
      setKeywords(keywordData.data || []);
      setTemplates(templateData.data || []);
      setCalendarEvents(calendarData.data || []);
      setTrendingTopics(trendsData.data || []);
      setContentSuggestions(suggestionsData.data || []);
  } catch (error) {
      console.error('Error loading content data: ', error);
  } finally {
      setLoading(false);
  }
};

  const handleCreatePost = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/content-marketing/posts', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(newPost),
    });

      if (response.ok) {
        await loadContentData();
        setDialogOpen(false);
        setNewPost({
          title: '',
          content: ', ',
          excerpt: ', ',
          status: 'draft',
          tags:  [],
          category: ', ',
          profession: 'photographer',
          targetKeywords:  [],
          metaDescription: ', ',
      });
    }
  } catch (error) {
      console.error('Error creating post:', error);
  } finally {
      setLoading(false);
  }
};

  const handleKeywordResearch = async (query: string, enhanced: boolean = true) => {
    setLoading(true);
    try {
      const response = await fetch('/api/content-marketing/keyword-research', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ query, market: 'norway', enhanced }),
    });

      if (response.ok) {
        const data = await response.json();
        setKeywords(data.keywords || []);
    }
  } catch (error) {
      console.error('Error researching keywords:', error);
  } finally {
      setLoading(false);
  }
};

  const handleTrendAnalysis = async (keyword: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/content-marketing/trends/keyword', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ keyword, region: 'NO',}),
    });

      if (response.ok) {
        const data = await response.json();
        setSelectedTrend(data.data);
    }
  } catch (error) {
      console.error('Error analyzing trends:', error);
  } finally {
      setLoading(false);
  }
};

  const generateSEOSuggestions = (post: BlogPost) => {
    const suggestions = [];

    if (post.title.length < 30) suggestions.push('Tittel bør være lengre for bedre SEO');
    if (post.metaDescription.length < 120)
      suggestions.push('Meta beskrivelse bør være mellom 120-160 tegn');
    if (post.targetKeywords.length === 0) suggestions.push('Legg til målrettede nøkkelord');
    if (post.content.length < 500)
      suggestions.push('Innhold bør være minst 500 ord for bedre rangering');

    return suggestions;
};

  const getContentTemplatesByProfession = (profession: string) => {
    return templates.filter((t) => t.profession === profession || t.profession === 'all');
};

  const getSEOScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
};

  const renderBlogManagement = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Blogginnlegg</Typography>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('add')}
          onClick={() => {
            setDialogType('create');
            setDialogOpen(true);
        }}
        >
          Nytt Innlegg
        </Button>
      </Box>

      <Grid container spacing={3}>
        {blogPosts.map((post) => (
          <Grid item xs={12} md={6} lg={4} key={post.id}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom noWrap sx={{ color: theming.colors.primary }}>
                  {post.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {post.excerpt}
                </Typography>

                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Chip
                    label={post.status}
                    size="small"
                    color={post.status === 'published' ? 'success' : 'default'}
                  />
                  <Chip label={post.profession} size="small" variant="outlined" />
                </Box>

                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Star size={16} />
                    <Typography variant="caption">SEO: {post.seoScore}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={post.seoScore}
                    color={getSEOScoreColor(post.seoScore)}
                    sx={{ flex: 1, height:  6, borderRadius:  3 }}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" gap={1}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Visibility fontSize="small" />
                      <Typography variant="caption">{post.views}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ThumbUp fontSize="small" />
                      <Typography variant="caption">{post.likes}</Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {post.readingTime} min lesing
                  </Typography>
                </Box>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button size="small" startIcon={theming.getThemedIcon('edit')}>
                  Rediger
                </Button>
                <Button size="small" startIcon={<Preview />}>
                  Forhåndsvis
                </Button>
                <Button size="small" startIcon={theming.getThemedIcon('analytics')}>
                  Statistikk
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderSEOTools = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        SEO & Nøkkelord
      </Typography>

      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Nøkkelord Research
        </Typography>
        <Box display="flex" gap={2} mb={3}>
          <TextField
            label="Søk etter nøkkelord"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="f.eks. bryllupsfotografering oslo"
            sx={{ flex:  1 }}
          />
          <Button variant="contained"
            onClick={() => handleKeywordResearch(searchTerm)}
            disabled={loading}
          >
            Analyser
          </Button>
        </Box>

        <Grid container spacing={2}>
          {keywords.map((keyword, index) => (
            <Grid item xs={12} md={6} key={index}>
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{keyword.keyword}</Typography>
                    <Chip
                      label={keyword.trend}
                      size="small"
                      color={
                        keyword.trend === 'up'
                          ? 'success'
                          : keyword.trend === 'down'
                            ? 'error'
                            : 'default'
                    }
                    />
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={4} >
                      <Typography variant="caption" color="text.secondary">
                        Søkevolum
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{keyword.searchVolume.toLocaleString()}</Typography>
                    </Grid>
                    <Grid item xs={4} >
                      <Typography variant="caption" color="text.secondary">
                        Vanskelighet
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{keyword.difficulty}%</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={keyword.difficulty}
                          sx={{ flex: 1, height:  4 }}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={4} >
                      <Typography variant="caption" color="text.secondary">
                        Relevans
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{keyword.relevance}%</Typography>
                    </Grid>
                  </Grid>

                  {keyword.suggestions.length > 0 && (
                    <Box mt={2}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Relaterte forslag: </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {keyword.suggestions.slice(0, 3).map((suggestion, i) => (
                          <Chip key={i} label={suggestion} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );

  const renderContentCalendar = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Innholdskalender
      </Typography>

      <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>Kommende Innhold</Typography>
          <Button variant="contained" startIcon={theming.getThemedIcon('add')} sx={theming.getThemedButtonSx()}>
            Planlegg Innhold
          </Button>
        </Box>

        <List>
          {calendarEvents.map((event) => (
            <React.Fragment key={event.id}>
              <ListItem>
                <ListItemIcon>
                  {event.type === 'blog' && {theming.getThemedIcon('article')}}
                  {event.type === 'social' && {theming.getThemedIcon('share')}}
                  {event.type === 'email' && <Comment />}
                  {event.type === 'video' && {theming.getThemedIcon('videoLibrary')}}
                </ListItemIcon>
                <ListItemText
                  primary={event.title}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {new Date(event.date).toLocaleDateString('no-NO')} • {event.type}
                      </Typography>
                      <Chip
                        label={event.status}
                        size="small"
                        color={event.status === 'completed' ? 'success' : 'default'}
                        sx={{ mt: 0.5}}
                      />
                    </Box>
                }
                />
                <IconButton>
                  <KeyboardArrowRight />
                </IconButton>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );

  const renderContentTemplates = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Innholdsmaler
      </Typography>

      <Box mb={3}>
        <FormControl sx={{ minWidth: 200}}>
          <InputLabel>Profesjon</InputLabel>
          <Select
            value={filterProfession}
            onChange={(e) => setFilterProfession(e.target.value)}
            label="Profesjon"
          >
            <MenuItem value="all">Alle</MenuItem>
            <MenuItem value="photographer">Fotograf</MenuItem>
            <MenuItem value="videographer">Videograf</MenuItem>
            <MenuItem value="musician">Musiker</MenuItem>
            <MenuItem value="vendor">Leverandør</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={3}>
        {templates
          .filter((t) => filterProfession === 'all' || t.profession === filterProfession)
          .map((template) => (
            <Grid item xs={12} md={6} key={template.id}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {template.category}
                  </Typography>

                  <Accordion>
                    <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')>
                      <Typography>Mal Preview</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap'}}>
                        {template.template.slice(0, 200)}...
                      </Typography>
                    </AccordionDetails>
                  </Accordion>

                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary">
                      Variabler: {template.variables.join(', ')}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions sx={theming.getThemedCardSx()}>
                  <Button size="small" startIcon={theming.getThemedIcon('contentCopy')}>
                    Bruk Mal
                  </Button>
                  <Button size="small" startIcon={theming.getThemedIcon('edit')}>
                    Tilpass
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
      </Grid>
    </Box>
  );

  const renderGoogleTrends = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Google Trends & Markedsanalyse
      </Typography>

      <Grid container spacing={3}>
        {/* Trending Topics Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Trending Temaer i Norge
            </Typography>
            {trendingTopics.map((topic, index) => (
              <Card key={index} sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>{topic.title}</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TrendingUp
                        color={topic.trend === 'up' ? 'success' : 'action'}
                        fontSize="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {topic.trafficIndex.toLocaleString()} søk
                      </Typography>
                    </Box>
                  </Box>

                  <Chip label={topic.category} size="small" color="primary" sx={{ mb:  2 }} />

                  {topic.articles.slice(0, 2).map((article: any, i: number) => (
                    <Box key=, {, i} sx={{ ml: 1, mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {article.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {article.source} • {article.timeAgo}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
                <CardActions sx={theming.getThemedCardSx()}>
                  <Button size="small" onClick={() => handleTrendAnalysis(topic.title)}>
                    Analyser Trend
                  </Button>
                  <Button size="small">Lag Innhold</Button>
                </CardActions>
              </Card>
            ))}
          </Paper>
        </Grid>

        {/* Content Suggestions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Trending Innholdsforslag
            </Typography>
            {contentSuggestions.map((suggestion, index) => (
              <Card key={index} sx={{ mb:  2 }} variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="between" alignItems="start" mb={1}>
                    <Typography variant="subtitle1" gutterBottom>
                      {suggestion.title}
                    </Typography>
                    {suggestion.trending && (
                      <Chip label="Trending" size="small" color="success" icon={theming.getThemedIcon('trendingUp')}} />
                    )}
                  </Box>

                  <Box display="flex" gap={1} mb={2}>
                    {suggestion.keywords?.slice(0, 3).map((keyword: string, i: number) => (
                      <Chip key=, {, i} label={keyword} size="small" variant="outlined" />
                    ))}
                  </Box>

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Vanskelighet: {suggestion.difficulty}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        Estimert trafikk: {suggestion.estimatedTraffic?.toLocaleString()}
                      </Typography>
                    </Box>
                    <Chip
                      label={suggestion.type}
                      size="small"
                      color={suggestion.type === 'blog' ? 'primary' : 'default'}
                    />
                  </Box>
                </CardContent>
                <CardActions sx={theming.getThemedCardSx()}>
                  <Button size="small" startIcon={<Create />}>
                    Bruk Forslag
                  </Button>
                  <Button size="small" startIcon={theming.getThemedIcon('search')}>
                    Analyser
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Paper>
        </Grid>

        {/* Trend Analysis Chart */}
        {selectedTrend && (
          <Grid item xs={12}>
            <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Trend Analyse: {selectedTrend.keyword}
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                  <Box
                    sx={{
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'}}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Trend graf for {selectedTrend.keyword} - siste 12 måneder
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" gutterBottom>
                    Relaterte Søk
                  </Typography>
                  <List dense>
                    {selectedTrend.relatedQueries?.slice(0, 5).map((query: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={query.query}
                          secondary={`${query.value}% interesse`}
                        />
                        <ListItemIcon>
                          {query.trend === 'up' && <TrendingUp color="success" fontSize="small" />}
                          {query.trend === 'down' && (
                            <TrendingUp
                              color="error"
                              fontSize="small"
                              sx={{ transform: 'rotate(180deg)'}}
                            />
                          )}
                          {query.trend === 'stable' && <KeyboardArrowRight fontSize="small" />}
                        </ListItemIcon>
                      </ListItem>
                    ))}
                  </List>

                  <Typography variant="subtitle1" gutterBottom sx={{ mt:  2 }}>
                    Geografisk Fordeling (Norge)
                  </Typography>
                  <List dense>
                    {selectedTrend.geoData?.slice(0, 5).map((geo: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText primary={geo.region} secondary={`${geo.value}% av søk`} />
                        <LinearProgress
                          variant="determinate"
                          value={geo.value}
                          sx={{ width:  60, ml:  1 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Enhanced Keyword Research */}
        <Grid item xs={12}>
          <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Intelligent Nøkkelord Research
            </Typography>
            <Box display="flex" gap={2} mb={3}>
              <TextField
                label="Analyser nøkkelord med Google Trends"
                variant="outlined"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="f.eks. bryllupsfotografering"
                sx={{ flex:  1 }}
              />
              <Button variant="contained"
                onClick={() => handleKeywordResearch(searchTerm, true)}
                disabled={loading}
                startIcon={theming.getThemedIcon('trendingUp')}
              >
                Trends Analyse
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleKeywordResearch(searchTerm, false)}
                disabled={loading}
              >
                Standard
              </Button>
            </Box>

            <Alert severity="info" sx={{ mb:  2 }}>
              <Typography variant="body2">
                Intelligent nøkkelord research bruker Google Trends data for å gi deg mer presise
                søkevolum, trendretning og relaterte nøkkelord spesifikt for det norske markedet.
              </Typography>
            </Alert>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAnalytics = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Innholdsanalyse
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {blogPosts.filter((p) => p.status === 'published').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Publiserte Artikler
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {blogPosts.reduce((sum, p) => sum + p.views, 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Visninger
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {Math.round(blogPosts.reduce((sum, p) => sum + p.seoScore, 0) / blogPosts.length) ||
                  0}
                %
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gjennomsnitt SEO Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {blogPosts.reduce((sum, p) => sum + p.shares, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Delinger
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p:  3, mt:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Beste Ytende Innhold
        </Typography>
        <List>
          {blogPosts
            .sort((a, b) => b.views - a.views)
            .slice(0, 5)
            .map((post, index) => (
              <ListItem key={post.id}>
                <ListItemText
                  primary={`#${index + 1} ${post.title}`}
                  secondary={`${post.views.toLocaleString()} visninger • ${post.likes} likes • SEO: ${post.seoScore}%`}
                />
              </ListItem>
            ))}
        </List>
      </Paper>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', p:  3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Innholdsmarkedsføring & SEO
      </Typography>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb:  3 }}>
        <Tab icon={theming.getThemedIcon('article')}} label="Blogg" />
        <Tab icon={theming.getThemedIcon('search')}} label="SEO & Nøkkelord" />
        <Tab icon={theming.getThemedIcon('trendingUp')}} label="Google Trends" />
        <Tab icon={theming.getThemedIcon('calendar')}} label="Innholdskalender" />
        <Tab icon={<Create />} label="Maler" />
        <Tab icon={theming.getThemedIcon('analytics')}} label="Analyse" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb:  2 }} />}

      {tabValue === 0 && renderBlogManagement()}
      {tabValue === 1 && renderSEOTools()}
      {tabValue === 2 && renderGoogleTrends()}
      {tabValue === 3 && renderContentCalendar()}
      {tabValue === 4 && renderContentTemplates()}
      {tabValue === 5 && renderAnalytics()}

      {/* Create/Edit Post Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogType === 'create' ? 'Nytt Blogginnlegg' : 'Rediger Innlegg'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                label="Tittel"
                fullWidth
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Profesjon</InputLabel>
                <Select
                  value={newPost.profession}
                  onChange={(e) => setNewPost({ ...newPost, profession: e.target.value })}
                  label="Profesjon"
                >
                  <MenuItem value="photographer">Fotograf</MenuItem>
                  <MenuItem value="videographer">Videograf</MenuItem>
                  <MenuItem value="musician">Musiker</MenuItem>
                  <MenuItem value="vendor">Leverandør</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Kategori"
                fullWidth
                value={newPost.category}
                onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Utdrag"
                fullWidth
                multiline
                rows={2}
                value={newPost.excerpt}
                onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Innhold"
                fullWidth
                multiline
                rows={8}
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Meta Beskrivelse"
                fullWidth
                multiline
                rows={2}
                value={newPost.metaDescription}
                onChange={(e) => setNewPost({ ...newPost, metaDescription: e.target.value })}
                helperText={`${newPost.metaDescription?.length || 0}/160 tegn`}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button onClick={handleCreatePost} variant="contained" disabled={loading} sx={theming.getThemedButtonSx()}>
            {dialogType === 'create' ? 'Opprett' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentMarketingEngine;
