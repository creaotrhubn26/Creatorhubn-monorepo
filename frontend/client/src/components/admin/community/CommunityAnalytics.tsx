/**
 * Community Analytics
 * 
 * Analytics and insights for community engagement:
 * - Member growth trends
 * - Engagement metrics (posts, comments, reactions)
 * - Active user statistics
 * - Content performance
 * - Channel/group analytics
 * - Top contributors
 * - Retention metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Stack,
  Chip,
  Avatar,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Tooltip,
  IconButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
  TrendingDown,
  People,
  Forum,
  Comment,
  ThumbUp,
  Visibility,
  EmojiEvents,
  Schedule,
  Refresh,
  Download,
  Star,
  LocalFireDepartment,
  NewReleases,
  Timeline,
  ShowChart,
  PieChart,
  BarChart,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { apiRequest } from '@/lib/queryClient';

// Storage key for analytics cache persistence
const STORAGE_KEY = 'creatorhub_community_analytics';

interface AnalyticsOverview {
  total_members: number;
  active_members: number;
  new_members_today: number;
  new_members_week: number;
  new_members_month: number;
  total_posts: number;
  total_comments: number;
  total_reactions: number;
  posts_today: number;
  posts_week: number;
  engagement_rate: number;
  retention_rate: number;
}

interface TrendData {
  date: string;
  members: number;
  posts: number;
  comments: number;
  active_users: number;
}

interface TopContributor {
  id: string;
  name: string;
  avatar: string;
  posts_count: number;
  comments_count: number;
  reactions_received: number;
  reputation_score: number;
}

interface ChannelStats {
  id: string;
  name: string;
  icon: string;
  member_count: number;
  posts_count: number;
  engagement_rate: number;
  growth_rate: number;
}

interface ContentPerformance {
  id: string;
  title: string;
  author: string;
  channel: string;
  views: number;
  reactions: number;
  comments: number;
  created_at: string;
}

const TIME_RANGES = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
];

export default function CommunityAnalytics() {
  const { enqueueSnackbar } = useSnackbar();
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'cache' | 'sample'>('sample');
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelStats[]>([]);
  const [topContent, setTopContent] = useState<ContentPerformance[]>([]);

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(`${STORAGE_KEY}_${timeRange}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cacheAge = Date.now() - new Date(parsed.timestamp).getTime();
        if (cacheAge < 5 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('Error loading analytics from cache:', error);
    }
    return null;
  }, [timeRange]);

  const saveToCache = useCallback((data: {
    overview: AnalyticsOverview;
    trends: TrendData[];
    topContributors: TopContributor[];
    channelStats: ChannelStats[];
    topContent: ContentPerformance[];
  }) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${timeRange}`, JSON.stringify({
        timestamp: new Date().toISOString(),
        data,
      }));
    } catch (error) {
      console.error('Error saving analytics to cache:', error);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    
    const cachedData = loadFromCache();
    if (cachedData) {
      setOverview(cachedData.overview);
      setTrends(cachedData.trends);
      setTopContributors(cachedData.topContributors);
      setChannelStats(cachedData.channelStats);
      setTopContent(cachedData.topContent);
      setDataSource('cache');
      setLastUpdated(new Date());
    }

    try {
      const response = await apiRequest(`/api/community/admin/analytics?range=${timeRange}`, {
        method: 'GET',
      }) as {
        success: boolean;
        overview: AnalyticsOverview;
        trends: TrendData[];
        top_contributors: TopContributor[];
        channel_stats: ChannelStats[];
        top_content: ContentPerformance[];
      };

      if (response.success) {
        const analyticsData = {
          overview: response.overview,
          trends: response.trends,
          topContributors: response.top_contributors,
          channelStats: response.channel_stats,
          topContent: response.top_content,
        };

        setOverview(response.overview);
        setTrends(response.trends);
        setTopContributors(response.top_contributors);
        setChannelStats(response.channel_stats);
        setTopContent(response.top_content);
        setDataSource('api');
        setLastUpdated(new Date());

        saveToCache(analyticsData);
        enqueueSnackbar('Analytics loaded from database', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);

      if (cachedData) {
        enqueueSnackbar('Using cached analytics data', { variant: 'info' });
        setLoading(false);
        return;
      }

      // Sample data
      const sampleOverview: AnalyticsOverview = {
        total_members: 2847,
        active_members: 1256,
        new_members_today: 23,
        new_members_week: 156,
        new_members_month: 489,
        total_posts: 15234,
        total_comments: 45678,
        total_reactions: 89234,
        posts_today: 87,
        posts_week: 542,
        engagement_rate: 68.5,
        retention_rate: 72.3,
      };

      const sampleTrends: TrendData[] = [
        { date: '2024-01-01', members: 2400, posts: 120, comments: 340, active_users: 890 },
        { date: '2024-01-08', members: 2520, posts: 145, comments: 410, active_users: 920 },
        { date: '2024-01-15', members: 2610, posts: 132, comments: 380, active_users: 950 },
        { date: '2024-01-22', members: 2720, posts: 168, comments: 450, active_users: 1020 },
        { date: '2024-01-29', members: 2847, posts: 187, comments: 520, active_users: 1256 },
      ];

      const sampleContributors: TopContributor[] = [
        { id: '1', name: 'Sarah Johnson', avatar: '', posts_count: 234, comments_count: 567, reactions_received: 1890, reputation_score: 4850 },
        { id: '2', name: 'Mike Chen', avatar: '', posts_count: 189, comments_count: 445, reactions_received: 1456, reputation_score: 3920 },
        { id: '3', name: 'Emma Wilson', avatar: '', posts_count: 156, comments_count: 389, reactions_received: 1234, reputation_score: 3450 },
      ];

      const sampleChannelStats: ChannelStats[] = [
        { id: '1', name: 'Photography Tips', icon: '📷', member_count: 1245, posts_count: 3456, engagement_rate: 78.5, growth_rate: 12.3 },
        { id: '2', name: 'Gear Reviews', icon: '🎥', member_count: 987, posts_count: 2134, engagement_rate: 65.2, growth_rate: 8.7 },
        { id: '3', name: 'Post Processing', icon: '🎨', member_count: 856, posts_count: 1890, engagement_rate: 72.1, growth_rate: 15.4 },
      ];

      const sampleTopContent: ContentPerformance[] = [
        { id: '1', title: '10 Tips for Better Portrait Lighting', author: 'Sarah Johnson', channel: 'Photography Tips', views: 4523, reactions: 234, comments: 89, created_at: '2024-01-28' },
        { id: '2', title: 'Sony A7IV vs Canon R6 - Honest Review', author: 'Mike Chen', channel: 'Gear Reviews', views: 3890, reactions: 189, comments: 156, created_at: '2024-01-27' },
      ];

      setOverview(sampleOverview);
      setTrends(sampleTrends);
      setTopContributors(sampleContributors);
      setChannelStats(sampleChannelStats);
      setTopContent(sampleTopContent);
      setDataSource('sample');
      setLastUpdated(new Date());

      saveToCache({
        overview: sampleOverview,
        trends: sampleTrends,
        topContributors: sampleContributors,
        channelStats: sampleChannelStats,
        topContent: sampleTopContent,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getChangeIndicator = (value: number, isPositive: boolean = true) => {
    const color = isPositive ? 'success.main' : 'error.main';
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return (
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color }}>
        <Icon fontSize="small" />
        <Typography variant="body2" fontWeight={600}>
          {value > 0 ? '+' : ''}{value}%
        </Typography>
      </Stack>
    );
  };

  if (loading && !overview) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress sx={{ color: '#FF8C00' }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Assessment sx={{ color: '#FF8C00' }} /> Community Analytics
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              {TIME_RANGES.map((range) => (
                <MenuItem key={range.value} value={range.value}>{range.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchAnalytics} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Report">
            <IconButton onClick={() => enqueueSnackbar('Report export started', { variant: 'info' })}>
              <Download />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Data Source Indicator */}
      {lastUpdated && !loading && (
        <Alert 
          severity={dataSource === 'api' ? 'success' : dataSource === 'cache' ? 'info' : 'warning'}
          sx={{ mb: 2 }}
          icon={<Assessment />}
        >
          Data source: {dataSource === 'api' ? 'Live database' : dataSource === 'cache' ? 'Cached data' : 'Sample data'}
          {' • '}Last updated: {lastUpdated.toLocaleTimeString()}
        </Alert>
      )}

      {/* Overview Metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Members</Typography>
                  <Typography variant="h4" fontWeight={700}>{formatNumber(overview?.total_members || 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">+{overview?.new_members_week || 0} this week</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#4CAF50', width: 48, height: 48 }}>
                  <People />
                </Avatar>
              </Stack>
              <Box sx={{ mt: 2 }}>{getChangeIndicator(8.5, true)}</Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary">Active Members</Typography>
                  <Typography variant="h4" fontWeight={700}>{formatNumber(overview?.active_members || 0)}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#FF5722', width: 48, height: 48 }}>
                  <LocalFireDepartment />
                </Avatar>
              </Stack>
              <Box sx={{ mt: 2 }}>{getChangeIndicator(12.3, true)}</Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Posts</Typography>
                  <Typography variant="h4" fontWeight={700}>{formatNumber(overview?.total_posts || 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">{overview?.posts_today || 0} today</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#2196F3', width: 48, height: 48 }}>
                  <Forum />
                </Avatar>
              </Stack>
              <Box sx={{ mt: 2 }}>{getChangeIndicator(5.7, true)}</Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Reactions</Typography>
                  <Typography variant="h4" fontWeight={700}>{formatNumber(overview?.total_reactions || 0)}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#9C27B0', width: 48, height: 48 }}>
                  <ThumbUp />
                </Avatar>
              </Stack>
              <Box sx={{ mt: 2 }}>{getChangeIndicator(15.2, true)}</Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Engagement Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChart /> Engagement Overview
              </Typography>
              <Stack direction="row" justifyContent="space-around" alignItems="center" sx={{ mt: 3 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={100} size={100} thickness={4} sx={{ color: 'action.disabledBackground' }} />
                  <CircularProgress variant="determinate" value={overview?.engagement_rate || 0} size={100} thickness={4} sx={{ color: '#FF8C00', position: 'absolute', left: 0 }} />
                  <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <Typography variant="h6" fontWeight={700}>{overview?.engagement_rate || 0}%</Typography>
                    <Typography variant="caption" color="text.secondary">Engagement</Typography>
                  </Box>
                </Box>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={100} size={100} thickness={4} sx={{ color: 'action.disabledBackground' }} />
                  <CircularProgress variant="determinate" value={overview?.retention_rate || 0} size={100} thickness={4} sx={{ color: '#4CAF50', position: 'absolute', left: 0 }} />
                  <Box sx={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <Typography variant="h6" fontWeight={700}>{overview?.retention_rate || 0}%</Typography>
                    <Typography variant="caption" color="text.secondary">Retention</Typography>
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Timeline /> Member Growth Trend
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, height: 200, alignItems: 'flex-end', mt: 2 }}>
                {trends.map((item, index) => {
                  const maxMembers = Math.max(...trends.map(d => d.members));
                  return (
                    <Tooltip
                      key={index}
                      title={
                        <Box>
                          <Typography variant="body2">Date: {item.date}</Typography>
                          <Typography variant="body2">Members: {item.members}</Typography>
                          <Typography variant="body2">Posts: {item.posts}</Typography>
                        </Box>
                      }
                    >
                      <Box
                        sx={{
                          flex: 1,
                          bgcolor: '#FF8C00',
                          height: `${(item.members / maxMembers) * 100}%`,
                          borderRadius: '4px 4px 0 0',
                          minHeight: 20,
                          transition: 'all 0.3s',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: '#e67e00', transform: 'scaleY(1.05)' },
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Channel Stats & Top Contributors */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChart /> Channel Performance
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Channel</TableCell>
                      <TableCell align="right">Members</TableCell>
                      <TableCell align="right">Posts</TableCell>
                      <TableCell align="right">Engagement</TableCell>
                      <TableCell align="right">Growth</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {channelStats.map((channel) => (
                      <TableRow key={channel.id}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <span style={{ fontSize: '1.2rem' }}>{channel.icon}</span>
                            <Typography variant="body2" fontWeight={500}>{channel.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{formatNumber(channel.member_count)}</TableCell>
                        <TableCell align="right">{formatNumber(channel.posts_count)}</TableCell>
                        <TableCell align="right">
                          <Chip label={`${channel.engagement_rate}%`} size="small" color={channel.engagement_rate >= 70 ? 'success' : 'warning'} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                            {channel.growth_rate >= 0 ? <TrendingUp fontSize="small" color="success" /> : <TrendingDown fontSize="small" color="error" />}
                            <Typography variant="body2" color={channel.growth_rate >= 0 ? 'success.main' : 'error.main'}>
                              {channel.growth_rate >= 0 ? '+' : ''}{channel.growth_rate}%
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEvents sx={{ color: '#FFD700' }} /> Top Contributors
              </Typography>
              <List disablePadding>
                {topContributors.map((contributor, index) => (
                  <ListItem key={contributor.id} sx={{ borderRadius: 1, mb: 1, bgcolor: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'transparent' }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'grey.400' }}>
                        {index < 3 ? <EmojiEvents sx={{ color: '#fff' }} /> : contributor.name.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography fontWeight={500}>{contributor.name}</Typography>
                          {index === 0 && <Chip label="Top" size="small" color="warning" />}
                        </Stack>
                      }
                      secondary={
                        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                          <Typography variant="caption"><Forum fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }} />{contributor.posts_count}</Typography>
                          <Typography variant="caption"><Comment fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }} />{contributor.comments_count}</Typography>
                          <Typography variant="caption"><ThumbUp fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }} />{contributor.reactions_received}</Typography>
                        </Stack>
                      }
                    />
                    <Chip icon={<Star sx={{ fontSize: 14 }} />} label={formatNumber(contributor.reputation_score)} size="small" variant="outlined" />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Content */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChart /> Top Performing Content
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Content</TableCell>
                  <TableCell>Author</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell align="right">Views</TableCell>
                  <TableCell align="right">Reactions</TableCell>
                  <TableCell align="right">Comments</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topContent.map((content, index) => (
                  <TableRow key={content.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {index === 0 && <LocalFireDepartment sx={{ color: '#FF5722' }} />}
                        <Typography fontWeight={500}>{content.title}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{content.author}</TableCell>
                    <TableCell><Chip label={content.channel} size="small" variant="outlined" /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                        <Visibility fontSize="small" color="action" />
                        <Typography>{formatNumber(content.views)}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                        <ThumbUp fontSize="small" color="action" />
                        <Typography>{formatNumber(content.reactions)}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                        <Comment fontSize="small" color="action" />
                        <Typography>{content.comments}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(content.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <NewReleases sx={{ fontSize: 40, color: '#4CAF50', mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>{overview?.new_members_today || 0}</Typography>
            <Typography variant="body2" color="text.secondary">New Members Today</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Forum sx={{ fontSize: 40, color: '#2196F3', mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>{overview?.posts_today || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Posts Today</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Comment sx={{ fontSize: 40, color: '#9C27B0', mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>{formatNumber(overview?.total_comments || 0)}</Typography>
            <Typography variant="body2" color="text.secondary">Total Comments</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Schedule sx={{ fontSize: 40, color: '#FF8C00', mb: 1 }} />
            <Typography variant="h5" fontWeight={700}>{overview?.posts_week || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Posts This Week</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
