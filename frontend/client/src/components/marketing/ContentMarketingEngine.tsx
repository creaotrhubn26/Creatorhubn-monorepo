import { useMemo, useState, type FC } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Analytics,
  Article,
  CalendarToday,
  Search,
  TrendingUp,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published';
  publishDate: string;
  tags: string[];
  category: string;
  profession: string;
  seoScore: number;
  views: number;
}

interface SEOKeyword {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  relevance: number;
  trend: 'up' | 'down' | 'stable';
}

interface ContentCalendarEvent {
  id: string;
  title: string;
  type: 'blog' | 'social' | 'email' | 'video';
  date: string;
  status: 'planned' | 'in-progress' | 'completed';
  assignedTo: string;
}

interface ContentMarketingEngineProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

interface NewPostForm {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  publishDate: string;
  tags: string;
  status: BlogPost['status'];
}

const fallbackPosts: BlogPost[] = [
  {
    id: 'post-1',
    title: 'How to Build a Wedding Story Arc That Converts',
    excerpt: 'A practical framework for lead-driven wedding films.',
    content: 'Long-form guide content for wedding filmmakers and studios.',
    status: 'published',
    publishDate: '2026-02-20',
    tags: ['wedding', 'storytelling', 'video-marketing'],
    category: 'strategy',
    profession: 'videographer',
    seoScore: 86,
    views: 1840,
  },
  {
    id: 'post-2',
    title: 'Portrait Session Funnel: From Reel to Booking',
    excerpt: 'Turn social traction into real portrait bookings.',
    content: 'Template-driven funnel with CTA and offer timing.',
    status: 'draft',
    publishDate: '2026-03-12',
    tags: ['portrait', 'lead-generation'],
    category: 'growth',
    profession: 'photographer',
    seoScore: 71,
    views: 210,
  },
];

const fallbackKeywords: SEOKeyword[] = [
  {
    keyword: 'wedding video oslo',
    searchVolume: 3400,
    difficulty: 52,
    relevance: 92,
    trend: 'up',
  },
  {
    keyword: 'cinematic wedding film norway',
    searchVolume: 1200,
    difficulty: 46,
    relevance: 88,
    trend: 'stable',
  },
  {
    keyword: 'portrait photographer oslo',
    searchVolume: 2100,
    difficulty: 57,
    relevance: 90,
    trend: 'up',
  },
];

const fallbackCalendar: ContentCalendarEvent[] = [
  {
    id: 'cal-1',
    title: 'Publish wedding conversion guide',
    type: 'blog',
    date: '2026-03-05',
    status: 'planned',
    assignedTo: 'Editorial AI',
  },
  {
    id: 'cal-2',
    title: 'Story Arc teaser clips campaign',
    type: 'social',
    date: '2026-03-07',
    status: 'in-progress',
    assignedTo: 'Growth Team',
  },
];

function tabA11yProps(index: number) {
  return {
    id: `content-marketing-tab-${index}`,
    'aria-controls': `content-marketing-tabpanel-${index}`,
  };
}

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`content-marketing-tabpanel-${index}`}
      aria-labelledby={`content-marketing-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index ? children : null}
    </Box>
  );
}

async function safeApiRequest<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await apiRequest(url);
    return response as T;
  } catch {
    return fallback;
  }
}

function scoreColor(score: number): 'error' | 'warning' | 'success' {
  if (score >= 80) {
    return 'success';
  }

  if (score >= 60) {
    return 'warning';
  }

  return 'error';
}

const ContentMarketingEngine: FC<ContentMarketingEngineProps> = ({ profession = 'photographer' }) => {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [newPost, setNewPost] = useState<NewPostForm>({
    title: '',
    excerpt: '',
    content: '',
    category: 'strategy',
    publishDate: '',
    tags: '',
    status: 'draft',
  });

  const postsQuery = useQuery({
    queryKey: ['/api/content-marketing/posts', profession],
    queryFn: async () =>
      safeApiRequest<BlogPost[]>(`/api/content-marketing/posts?profession=${encodeURIComponent(profession)}`, fallbackPosts),
  });

  const keywordsQuery = useQuery({
    queryKey: ['/api/content-marketing/keywords', profession],
    queryFn: async () =>
      safeApiRequest<SEOKeyword[]>(`/api/content-marketing/keywords?profession=${encodeURIComponent(profession)}`, fallbackKeywords),
  });

  const calendarQuery = useQuery({
    queryKey: ['/api/content-marketing/calendar', profession],
    queryFn: async () =>
      safeApiRequest<ContentCalendarEvent[]>(
        `/api/content-marketing/calendar?profession=${encodeURIComponent(profession)}`,
        fallbackCalendar,
      ),
  });

  const createPostMutation = useMutation({
    mutationFn: async (form: NewPostForm) => {
      const payload = {
        title: form.title.trim(),
        excerpt: form.excerpt.trim(),
        content: form.content.trim(),
        category: form.category,
        publishDate: form.publishDate,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        status: form.status,
        profession,
      };

      await apiRequest('/api/content-marketing/posts', { method: 'POST', body: payload });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setOperationMessage('Post created successfully.');
      setNewPost({
        title: '',
        excerpt: '',
        content: '',
        category: 'strategy',
        publishDate: '',
        tags: '',
        status: 'draft',
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/content-marketing/posts', profession] });
    },
    onError: () => {
      setOperationMessage('Could not create post.');
    },
  });

  const keywordResearchMutation = useMutation({
    mutationFn: async (query: string) => {
      await apiRequest('/api/content-marketing/keyword-research', {
        method: 'POST',
        body: { query, market: 'norway', profession },
      });
    },
    onSuccess: async () => {
      setOperationMessage('Keyword research completed.');
      await queryClient.invalidateQueries({ queryKey: ['/api/content-marketing/keywords', profession] });
    },
    onError: () => {
      setOperationMessage('Keyword research failed.');
    },
  });

  const posts = postsQuery.data ?? fallbackPosts;
  const keywords = keywordsQuery.data ?? fallbackKeywords;
  const calendarEvents = calendarQuery.data ?? fallbackCalendar;

  const isLoading = postsQuery.isLoading || keywordsQuery.isLoading || calendarQuery.isLoading;

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [posts, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.category))).sort((left, right) => left.localeCompare(right));
  }, [posts]);

  const averageSeoScore =
    posts.length > 0 ? posts.reduce((sum, post) => sum + post.seoScore, 0) / posts.length : 0;

  const totalViews = posts.reduce((sum, post) => sum + post.views, 0);

  const handleRefresh = async () => {
    await Promise.all([postsQuery.refetch(), keywordsQuery.refetch(), calendarQuery.refetch()]);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Content Marketing Engine
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Profession: {profession.replace(/_/g, ' ')}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button startIcon={<Search />} variant="outlined" onClick={() => keywordResearchMutation.mutate(keywordQuery)} disabled={keywordQuery.trim().length === 0 || keywordResearchMutation.isPending}>
            Research Keywords
          </Button>
          <Button startIcon={<Add />} variant="contained" onClick={() => setDialogOpen(true)}>
            New Post
          </Button>
          <Button startIcon={<TrendingUp />} variant="outlined" onClick={handleRefresh}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {operationMessage ? (
        <Alert
          severity={operationMessage.includes('successfully') || operationMessage.includes('completed') ? 'success' : 'warning'}
          sx={{ mt: 2 }}
          onClose={() => setOperationMessage(null)}
        >
          {operationMessage}
        </Alert>
      ) : null}

      {isLoading ? <LinearProgress sx={{ mt: 2 }} /> : null}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Published / Total Posts
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {posts.filter((post) => post.status === 'published').length} / {posts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Average SEO Score
              </Typography>
              <Chip label={`${averageSeoScore.toFixed(1)} / 100`} color={scoreColor(averageSeoScore)} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Views
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {totalViews.toLocaleString('nb-NO')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)}>
          <Tab icon={<Article />} iconPosition="start" label="Posts" {...tabA11yProps(0)} />
          <Tab icon={<Search />} iconPosition="start" label="Keywords" {...tabA11yProps(1)} />
          <Tab icon={<CalendarToday />} iconPosition="start" label="Calendar" {...tabA11yProps(2)} />
          <Tab icon={<Analytics />} iconPosition="start" label="Insights" {...tabA11yProps(3)} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Search posts"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel id="content-marketing-category-label">Category</InputLabel>
              <Select
                labelId="content-marketing-category-label"
                label="Category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>SEO</TableCell>
                    <TableCell>Views</TableCell>
                    <TableCell>Publish Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPosts.map((post) => (
                    <TableRow key={post.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{post.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {post.excerpt}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={post.status}
                          color={post.status === 'published' ? 'success' : post.status === 'scheduled' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{post.category}</TableCell>
                      <TableCell>
                        <Chip size="small" label={post.seoScore} color={scoreColor(post.seoScore)} />
                      </TableCell>
                      <TableCell>{post.views.toLocaleString('nb-NO')}</TableCell>
                      <TableCell>{new Date(post.publishDate).toLocaleDateString('nb-NO')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Keyword query"
              value={keywordQuery}
              onChange={(event) => setKeywordQuery(event.target.value)}
              placeholder="e.g. wedding video norway"
              fullWidth
            />
          </Stack>

          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Keyword</TableCell>
                    <TableCell>Volume</TableCell>
                    <TableCell>Difficulty</TableCell>
                    <TableCell>Relevance</TableCell>
                    <TableCell>Trend</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {keywords.map((keyword) => (
                    <TableRow key={keyword.keyword}>
                      <TableCell>{keyword.keyword}</TableCell>
                      <TableCell>{keyword.searchVolume.toLocaleString('nb-NO')}</TableCell>
                      <TableCell>{keyword.difficulty}</TableCell>
                      <TableCell>{keyword.relevance}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={keyword.trend}
                          color={keyword.trend === 'up' ? 'success' : keyword.trend === 'down' ? 'error' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Assigned To</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {calendarEvents.map((event) => (
                    <TableRow key={event.id} hover>
                      <TableCell>{event.title}</TableCell>
                      <TableCell>{event.type}</TableCell>
                      <TableCell>{new Date(event.date).toLocaleDateString('nb-NO')}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={event.status}
                          color={
                            event.status === 'completed'
                              ? 'success'
                              : event.status === 'in-progress'
                                ? 'warning'
                                : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>{event.assignedTo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Prioritize topics with high relevance and low-to-medium keyword difficulty for faster ranking wins.
          </Alert>
          <Alert severity="success" sx={{ mb: 2 }}>
            Posts with structured metadata and clear CTA tend to convert better for service-based creators.
          </Alert>
          <Alert severity="warning">
            Keep publish cadence stable to avoid volatility in impressions and ranking consistency.
          </Alert>
        </TabPanel>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create Content Post</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={newPost.title}
              onChange={(event) => setNewPost((current) => ({ ...current, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Excerpt"
              value={newPost.excerpt}
              onChange={(event) => setNewPost((current) => ({ ...current, excerpt: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Content"
              value={newPost.content}
              onChange={(event) => setNewPost((current) => ({ ...current, content: event.target.value }))}
              multiline
              minRows={6}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Category"
                  value={newPost.category}
                  onChange={(event) => setNewPost((current) => ({ ...current, category: event.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Publish Date"
                  type="date"
                  value={newPost.publishDate}
                  onChange={(event) => setNewPost((current) => ({ ...current, publishDate: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel id="new-post-status-label">Status</InputLabel>
                  <Select
                    labelId="new-post-status-label"
                    label="Status"
                    value={newPost.status}
                    onChange={(event) =>
                      setNewPost((current) => ({ ...current, status: event.target.value as BlogPost['status'] }))
                    }
                  >
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="published">Published</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <TextField
              label="Tags (comma separated)"
              value={newPost.tags}
              onChange={(event) => setNewPost((current) => ({ ...current, tags: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createPostMutation.mutate(newPost)}
            disabled={
              createPostMutation.isPending ||
              newPost.title.trim().length === 0 ||
              newPost.content.trim().length === 0
            }
          >
            Save Post
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentMarketingEngine;
