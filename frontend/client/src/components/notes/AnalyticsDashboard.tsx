// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Stack,
  LinearProgress,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  format: 'number' | 'percentage' | 'currency' | 'duration';
  description: string;
  category: 'engagement' | 'performance' | 'content' | 'user'
}

interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  target: string;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

interface ContentPerformance {
  id: string;
  title: string;
  type: 'document' | 'interactive' | 'simulation' | 'diagram';
  views: number;
  interactions: number;
  completionRate: number;
  avgTimeSpent: number;
  rating: number;
  lastAccessed: Date
}

interface AnalyticsFilter {
  timeRange: '1h' | '24h' | '7d' | '30d' | '90d' | '1y';
  contentType: 'all' | 'document' | 'interactive' | 'simulation' | 'diagram';
  userType: 'all' | 'internal' | 'external';
  metric: 'views' | 'interactions' | 'completion' | 'time'
}

interface AnalyticsDashboardProps {
  className?: string;
  onExport?: (format: 'pdf' | 'csv' | 'json') => void;
  onFilterChange?: (filters: AnalyticsFilter) => void;
  onMetricClick?: (metric: AnalyticsMetric) => void
}

// Mock data






const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className ='',
  onExport,
  onFilterChange,
  onMetricClick
}) => {
  // State
  const [filters, setFilters] = useState<AnalyticsFilter>({
    timeRange: '7',
    contentType: 'all',
    userType: 'all',
    metric: 'views'
});
  const [selectedMetric, setSelectedMetric] = useState<AnalyticsMetric | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [activeTab, setActiveTab] = useState(0);
  const [expandedMetric, setExpandedMetric] = useState<string | false>(false);

  // Handlers
  const handleFilterChange = useCallback((newFilters: Partial<AnalyticsFilter>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
}, [filters, onFilterChange]);

  const handleMetricClick = useCallback((metric: AnalyticsMetric) => {
    setSelectedMetric(metric);
    onMetricClick?.(metric);
}, [onMetricClick]);

  const handleExport = useCallback(() => {
    onExport?.(exportFormat);
    setShowExportDialog(false);
}, [onExport, exportFormat]);

  const formatMetricValue = useCallback((metric: AnalyticsMetric) => {
    const { value, format } = metric;
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD',}).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'duration':
        return `${value} min`;
      default: return new Intl.NumberFormat('en-US').format(value);
}
}, []);

  const getTrendIcon = useCallback((trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <CREATOR_HUB_ICONS.trendingUp color="success" />;
      case 'down':
        return <CREATOR_HUB_ICONS.trendingUp sx={{ transform: 'rotate(180deg)'}} color="error" />;
      default: return <CREATOR_HUB_ICONS.timeline color="info" />;
}
}, []);

  const getContentTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'document':
        return <CREATOR_HUB_ICONS.article />;
      case 'interactive':
        return <CREATOR_HUB_ICONS.smartToy />;
      case 'simulation':
        return <CREATOR_HUB_ICONS.playArrow />;
      case 'diagram':
        return <CREATOR_HUB_ICONS.accountTree />;
      default:
        return <CREATOR_HUB_ICONS.description />;
}
}, []);

  const getActionIcon = useCallback((action: string) => {
    switch (action.toLowerCase()) {
      case 'viewed':
        return <CREATOR_HUB_ICONS.visibility />;
      case 'completed':
        return <CREATOR_HUB_ICONS.checkCircle />;
      case 'created':
        return <CREATOR_HUB_ICONS.add />;
      case 'shared':
        return <CREATOR_HUB_ICONS.share />;
      case 'commented':
        return <CREATOR_HUB_ICONS.comment />;
      default:
        return <CREATOR_HUB_ICONS.info />;
}
}, []);

  // Memoized filtered data
  const filteredMetrics = useMemo(() => {
    return mockMetrics.filter(metric => {
      if (filters.category && metric.category !== filters.category) return false;
      return true;
  });
}, [filters]);

  const filteredActivities = useMemo(() => {
    return mockUserActivities.filter(activity => {
      if (filters.userType === 'internal' && !activity.userId.startsWith('internal')) return false;
      if (filters.userType === 'external' && activity.userId.startsWith('internal')) return false;
      return true;
  });
}, [filters]);

  const filteredContent = useMemo(() => {
    return mockContentPerformance.filter(content => {
      if (filters.contentType !== 'all' && content.type !== filters.contentType) return false;
      return true;
  });
}, [filters]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.analytics sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Analytics Dashboard</Typography>
              <Typography variant="body2" color="text.secondary">
                Track performance and user engagement
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.download />}
              onClick={() => setShowExportDialog(true)}
            >
              Export
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.settings sx={theming.getThemedButtonSx()} />}
            >
              Settings
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={filters.timeRange}
              onChange={(e) => handleFilterChange({ timeRange: e.target.value as any })}
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Content Type</InputLabel>
            <Select
              value={filters.contentType}
              onChange={(e) => handleFilterChange({ contentType: e.target.value as any })}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="document">Documents</MenuItem>
              <MenuItem value="interactive">Interactive</MenuItem>
              <MenuItem value="simulation">Simulations</MenuItem>
              <MenuItem value="diagram">Diagrams</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>User Type</InputLabel>
            <Select
              value={filters.userType}
              onChange={(e) => handleFilterChange({ userType: e.target.value as any })}
            >
              <MenuItem value="all">All Users</MenuItem>
              <MenuItem value="internal">Internal</MenuItem>
              <MenuItem value="external">External</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Overview" icon={<CREATOR_HUB_ICONS.assessment />} />
        <Tab label="Content Performance" icon={<CREATOR_HUB_ICONS.article />} />
        <Tab label="User Activity" icon={<CREATOR_HUB_ICONS.group />} />
        <Tab label="Engagement" icon={<CREATOR_HUB_ICONS.timeline />} />
      </Tabs>

      {/* Overview Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Key Metrics */}
          {filteredMetrics.map((metric) => (
            <Grid item xs={12} sm={6} md={4} key={metric.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer','&:hover': { elevation:  4 },
                  transition: 'all 0.2s'
            }}
                onClick={() => handleMetricClick(metric)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {metric.name}
                      </Typography>
                      <Typography variant="h4" component="div" sx={{ color: theming.colors.primary }}>
                        {formatMetricValue(metric)}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt:  1 }}>
                        {getTrendIcon(metric.trend)}
                        <Typography 
                          variant="body2" 
                          color={metric.trend === 'up' ? 'success.main' : metric.trend === 'down' ? 'error.main' : 'text.secondary'}
                        >
                          {metric.change > 0 ? '+' : ', '},{metric.change.toFixed(1)}%
                        </Typography>
                      </Stack>
                    </Box>
                    <Chip 
                      label={metric.category}
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Content Performance Tab */}
      {activeTab === 1 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Content Performance
          </Typography>
          <List>
            {filteredContent.map((content) => (
              <React.Fragment key={content.id}>
                <ListItem>
                  <ListItemIcon>
                    {getContentTypeIcon(content.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="subtitle1">{content.title}</Typography>
                        <Chip label={content.type} size="small" variant="outlined" />
                        <Chip 
                          label={`${content.rating.toFixed(1)}★`}
                          size="small" 
                          color="warning" 
                        />
                      </Stack>
                  }
                    secondary={
                      <Stack spacing={1} sx={{ mt:  1 }}>
                        <Stack direction="row" spacing={4}>
                          <Typography variant="body2">
                            <strong>Views: </strong> {content.views.toLocaleString()}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Interactions: </strong> {content.interactions.toLocaleString()}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Completion: </strong> {content.completionRate.toFixed()}%
                          </Typography>
                          <Typography variant="body2">
                            <strong>Avg Time: </strong> {content.avgTimeSpent.toFixed()} min
                          </Typography>
                        </Stack>
                        <LinearProgress 
                          variant="determinate" 
                          value={content.completionRate}
                          sx={{ height:  6, borderRadius:  3 }}
                        />
                      </Stack>
                  }
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* User Activity Tab */}
      {activeTab === 2 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Recent User Activity
          </Typography>
          <List>
            {filteredActivities.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  {getActionIcon(activity.action)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ width:  24, height: 24}}>
                        {activity.userName.charAt(0)}
                      </Avatar>
                      <Typography variant="subtitle1">{activity.userName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activity.action}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {activity.target}
                      </Typography>
                    </Stack>
                }
                  secondary={
                    <Stack direction="row" spacing={2} sx={{ mt:  1 }}>
                      <Typography variant="caption">
                        {activity.timestamp.toLocaleString()}
                      </Typography>
                      {activity.duration && (
                        <Typography variant="caption">
                          Duration: {Math.floor(activity.duration / 6)}m {activity.duration % 60}s
                        </Typography>
                      )}
                    </Stack>
                }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Engagement Tab */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Engagement Trends
              </Typography>
              <Box sx={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Typography color="text.secondary">
                  Chart visualization would go here
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Top Performing Content
              </Typography>
              <List dense>
                {filteredContent
                  .sort((a, b) => b.views - a.views)
                  .slice(0, 5)
                  .map((content, index) => (
                    <ListItem key={content.id}>
                      <ListItemIcon>
                        <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                          {index + 1}
                        </Typography>
                      </ListItemIcon>
                      <ListItemText
                        primary={content.title}
                        secondary={`${content.views.toLocaleString()} views`}
                      />
                    </ListItem>
                  ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)}>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.download />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Export Analytics Data</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt:  2 }}>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
            >
              <MenuItem value="pdf">PDF Report</MenuItem>
              <MenuItem value="csv">CSV Data</MenuItem>
              <MenuItem value="json">JSON Data</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleExport} sx={theming.getThemedButtonSx()}>
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnalyticsDashboard;

