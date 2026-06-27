/**
 * Enhanced Activity Feed with Advanced Features
 * - Timeline/List view toggle
 * - Advanced search and filters
 * - CSV export
 * - Date range filtering
 * - Real-time push notifications
 * - Category grouping
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  Divider,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  TextField,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Collapse,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
} from '@mui/material';
import {
  Science,
  Feedback,
  PersonAdd,
  CheckCircle,
  Cancel,
  Visibility,
  Email,
  BugReport,
  ThumbUp,
  Dashboard as DashboardIcon,
  Refresh,
  FilterList,
  ArrowForward,
  FileDownload,
  Search as SearchIcon,
  ViewList,
  ViewTimeline,
  AccountCircle,
  Payment,
  CardMembership,
  Login,
  Settings as SettingsIcon,
  ExpandMore,
  Notifications,
  TrendingUp,
} from '@mui/icons-material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import PaymentMethodLogo from '../common/PaymentMethodLogo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiRequest,
  isApiEndpointMissing,
  isKnownUnavailableApiEndpoint,
} from '@/lib/queryClient';
import { useTheming } from '@/utils/theming-helper';
import { useLocation } from 'wouter';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { AdminButton } from './design-system';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  user: {
    name: string;
    email: string;
    profession?: string;
  };
  metadata?: any;
  timestamp: string;
  status?: string;
  actionUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
}

interface EnhancedActivityFeedProps {
  maxItems?: number;
  showFilters?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableTimeline?: boolean;
  enableExport?: boolean;
  enableNotifications?: boolean;
}

export default function EnhancedActivityFeed({
  maxItems = 20,
  showFilters = true,
  autoRefresh = true,
  refreshInterval = 30000,
  enableTimeline = true,
  enableExport = true,
  enableNotifications = true
}: EnhancedActivityFeedProps) {
  const emptyActivityFeed = { activities: [], total: 0, hasMore: false };
  const emptyPendingCounts = {
    total: 0,
    inviteRequests: 0,
    prototypeFeedback: 0,
    bugReports: 0,
  };
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const theming = useTheming('prototype_tester');
  const { auth } = useEnhancedMasterIntegration();
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications - get userId from auth if available
  const userId = auth.state.user?.id ?? 'guest';
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // State
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Advanced filters state (used by UI below)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const activityFeedEnabled = !isKnownUnavailableApiEndpoint('/api/admin/activity-feed');
  const pendingCountsEnabled = !isKnownUnavailableApiEndpoint('/api/admin/pending-counts');

  // Debounce search so we don't refetch on each keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch activity feed with all filters
  const { data: activityData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['/api/admin/activity-feed', { filterType, maxItems, searchQuery: debouncedSearch, startDate, endDate, categoryFilter, priorityFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({
        type: filterType,
        limit: maxItems.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
      });

      const headers = await auth.getAuthHeader();
      try {
        return await apiRequest(`/api/admin/activity-feed?${params.toString()}`, { headers });
      } catch (queryError) {
        if (isApiEndpointMissing(queryError)) {
          console.debug('EnhancedActivityFeed: activity-feed endpoint unavailable, using empty fallback.');
          return emptyActivityFeed;
        }
        throw queryError;
      }
    },
    enabled: activityFeedEnabled,
    staleTime: autoRefresh ? refreshInterval : 60000,
    refetchInterval: activityFeedEnabled && autoRefresh ? refreshInterval : false,
    placeholderData: (prev) => prev || emptyActivityFeed,
    retry: false,
  });

  const activities = Array.isArray(activityData?.activities) ? activityData.activities : [];
  const total = activityData?.total || 0;
  const hasMore = activityData?.hasMore || false;

  // Fetch pending counts
  const { data: pendingCounts } = useQuery({
    queryKey: ['/api/admin/pending-counts'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      try {
        return await apiRequest('/api/admin/pending-counts', { headers });
      } catch (queryError) {
        if (isApiEndpointMissing(queryError)) {
          console.debug('EnhancedActivityFeed: pending-counts endpoint unavailable, using empty fallback.');
          return emptyPendingCounts;
        }
        throw queryError;
      }
    },
    enabled: pendingCountsEnabled,
    staleTime: refreshInterval,
    refetchInterval: pendingCountsEnabled && autoRefresh ? refreshInterval : false,
    retry: false,
    placeholderData: emptyPendingCounts,
  });

// Push notifications for critical events (guarded for SSR and permission flow)
useEffect(() => {
  if (!enableNotifications) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  const items = Array.isArray(activityData?.activities) ? activityData.activities : [];
  const criticalActivities = items.filter(
    (a: ActivityItem) => a.priority === 'critical' && a.status === 'pending'
  );
  if (criticalActivities.length === 0) return;

  const show = () =>
    criticalActivities.slice(0, 3).forEach((activity: ActivityItem) => {
      new Notification('CreatorHub Norge Admin Alert', {
        body: activity.title,
        icon: '/creatorhub-icon.png',
        tag: activity.id,
        requireInteraction: true,
      });
    });
    
    if (Notification.permission === 'granted') {
      show();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') show();
      });
    }
  }, [activityData?.activities, enableNotifications]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/activity-feed'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-counts'] });
  };
  
  const handleExportCSV = async () => {
    const params = new URLSearchParams({
      type: filterType,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(categoryFilter !== 'all' && { category: categoryFilter }),
      ...(priorityFilter !== 'all' && { priority: priorityFilter }) 
    });
    
    window.open(`/api/admin/activity-feed/export?${params.toString()}`, '_blank');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'prototype_feedback': return <Feedback sx={{ color: '#2196f3' }} />;
      case 'invite_request': return <PersonAdd sx={{ color: '#ff8c00' }} />;
      case 'bug_report': return <BugReport sx={{ color: '#f44336' }} />;
      case 'feature_vote': return <ThumbUp sx={{ color: '#4caf50' }} />;
      case 'user_approved': return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'user_rejected': return <Cancel sx={{ color: '#f44336' }} />;
      case 'account_activated': return <AccountCircle sx={{ color: '#4caf50' }} />;
      case 'subscription_created': return <CardMembership sx={{ color: '#ce93d8' }} />;
      case 'payment_completed': return <Payment sx={{ color: '#2e7d32' }} />;
      case 'user_login': return <Login sx={{ color: '#60a5fa' }} />;
      case 'feature_enabled': return <SettingsIcon sx={{ color: '#ff9800' }} />;
      default: return <DashboardIcon sx={{ color: '#9e9e9e' }} />;
    }
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      prototype_feedback: '#2196f3',
      invite_request: '#ff8c00',
      bug_report: '#f44336',
      feature_vote: '#4caf50',
      user_approved: '#4caf50',
      user_rejected: '#f44336',
      account_activated: '#4caf50',
      subscription_created: '#9c27b0',
      payment_completed: '#2e7d32',
      user_login: '#1976d2',
      feature_enabled: '#ff9800'
    };
    return colors[type] || '#9e9e9e';
  };

  const handleActivityClick = (activity: ActivityItem) => {
    if (activity.actionUrl) {
      setLocation(activity.actionUrl);
    } else {
      setSelectedActivity(activity);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Akkurat nå';
    if (diffMins < 60) return `${diffMins} min siden`;
    if (diffHours < 24) return `${diffHours} timer siden`;
    if (diffDays < 7) return `${diffDays} dager siden`;
    return date.toLocaleDateString('nb-NO');
  };
  
  const renderListView = () => (
    <List sx={{ py: 0 }}>
      {activities.map((activity: ActivityItem, index: number) => (
        <React.Fragment key={activity.id}>
          <ListItem
            sx={{
              cursor: 'pointer',
              borderRadius: 1,
              mb: 1, '&:hover': { bgcolor: 'action.hover' }
            }}
            secondaryAction={
              <Stack direction="row" spacing={1} alignItems="center">
                {activity.priority === 'critical' && (
                  <Chip label="CRITICAL" size="small" color="error" sx={{ fontSize: '0.65rem', height: 18, fontWeight: 'bold' }} />
                )}
                {activity.status && (
                  <Chip
                    label={activity.status}
                    size="small"
                    color={
                      activity.status === 'approved' || activity.status === 'active' || activity.status === 'paid' ? 'success' :
                      activity.status === 'rejected' ? 'error' :
                      activity.status === 'pending' ? 'warning' : 'default'
                    }
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                )}
                <IconButton size="small" aria-label="Åpne aktivitet" onClick={() => handleActivityClick(activity)}>
                  <ArrowForward fontSize="small" />
                </IconButton>
              </Stack>
            }
          >
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: `${getActivityColor(activity.type)}20` }}>
                {getActivityIcon(activity.type)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    {activity.title}
                  </Typography>
                  {activity.user.profession && (
                    <Chip label={activity.user.profession} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                  )}
                </Stack>
              }
              secondary={
                <React.Fragment>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                    {activity.description}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {activity.user.name} • {formatTimestamp(activity.timestamp)}
                    </Typography>
                    {/* Show payment method logo if available */}
                    {activity.metadata?.paymentMethod && (
                      <PaymentMethodLogo 
                        method={activity.metadata.paymentMethod} 
                        size="small"
                        showTooltip={true}
                      />
                    )}
                  </Stack>
                </React.Fragment>
              }
            />
          </ListItem>
          {index < activities.length - 1 && <Divider variant="inset" component="li" />}
        </React.Fragment>
      ))}
    </List>
  );
  
  const renderTimelineView = () => (
    <Timeline position="right">
      {activities.map((activity: ActivityItem) => (
        <TimelineItem key={activity.id}>
          <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.2 }}>
            <Typography variant="caption">
              {new Date(activity.timestamp).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <Typography variant="caption" display="block">
              {new Date(activity.timestamp).toLocaleDateString('nb-NO', { month: 'short', day: 'numeric' })}
            </Typography>
          </TimelineOppositeContent>
          <TimelineSeparator>
            <TimelineDot sx={{ bgcolor: getActivityColor(activity.type) }}>
              {getActivityIcon(activity.type)}
            </TimelineDot>
            <TimelineConnector />
          </TimelineSeparator>
          <TimelineContent>
            <Paper
              elevation={1}
              role="button"
              tabIndex={0}
              sx={{
                p: 2,
                cursor: 'pointer','&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={() => handleActivityClick(activity)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleActivityClick(activity);
                }
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                  {activity.title}
                </Typography>
                {activity.user.profession && (
                  <Chip label={activity.user.profession} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />
                )}
                {activity.status && (
                  <Chip
                    label={activity.status}
                    size="small"
                    color={
                      activity.status === 'approved' || activity.status === 'active' || activity.status === 'paid' ? 'success' :
                      activity.status === 'rejected' ? 'error' :
                      activity.status === 'pending' ? 'warning' : 'default'
                    }
                    sx={{ fontSize: '0.7rem', height: 18 }}
                  />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {activity.description}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activity.user.name}
              </Typography>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );

  return (
    <Card>
      <CardContent>
        {!activityFeedEnabled && !pendingCountsEnabled ? (
          <Alert severity="info" sx={{ mb: 3, borderRadius: '18px' }}>
            Aktivitetsstrømmen er ikke live i production ennå. Panelet er derfor satt i passiv
            modus for å unngå 404-støy i konsollen.
          </Alert>
        ) : null}

        {/* Header with Controls */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <DashboardIcon sx={{ color: theming.colors.primary, fontSize: 28 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  Enhanced Activity Feed
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Real-time updates • {total} total activities
                </Typography>
              </Box>
            </Stack>
            
            <Stack direction="row" spacing={1}>
              {pendingCounts && pendingCounts.total > 0 && (
                <Chip
                  label={`${pendingCounts.total} pending`}
                  size="small"
                  color="warning"
                  icon={<Notifications />}
                />
              )}
              
              {isSupported && (
                <Tooltip title="Push-varsler innstillinger">
                  <IconButton size="small" aria-label="Push-varsler innstillinger" onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                    <Notifications />
                  </IconButton>
                </Tooltip>
              )}
              
              {enableExport && (
                <Tooltip title="Export to CSV">
                  <IconButton size="small" aria-label="Export to CSV" onClick={handleExportCSV}>
                    <FileDownload />
                  </IconButton>
                </Tooltip>
              )}
              
              <Tooltip title="Refresh">
                <IconButton size="small" aria-label="Refresh" onClick={handleRefresh}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Search and View Toggle */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search activities..."
              aria-label="Søk i aktiviteter"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{ flexGrow: 1 }}
            />
            
            {enableTimeline && (
              <ToggleButtonGroup
                size="small"
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
              >
                <ToggleButton value="list" aria-label="Listevisning">
                  <Tooltip title="List View">
                    <ViewList fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="timeline" aria-label="Tidslinjevisning">
                  <Tooltip title="Timeline View">
                    <ViewTimeline fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            
            <IconButton size="small" aria-label="Vis avanserte filtre" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <FilterList />
            </IconButton>
          </Stack>

          {/* Advanced Filters (Collapsible) */}
          <Collapse in={showAdvancedFilters}>
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600}}>
                Advanced Filters
              </Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    fullWidth
                  />
                </Stack>
                
                <Stack direction="row" spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      label="Category"
                    >
                      <MenuItem value="all">All Categories</MenuItem>
                      <MenuItem value="user_management">User Management</MenuItem>
                      <MenuItem value="billing">Billing & Payments</MenuItem>
                      <MenuItem value="testing">Testing & QA</MenuItem>
                      <MenuItem value="system">System Events</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl size="small" fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      label="Priority"
                    >
                      <MenuItem value="all">All Priorities</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                
                <AdminButton
                  size="small"
                  tone="secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                    setCategoryFilter('all');
                    setPriorityFilter('all');
                  }}
                >
                  Clear Filters
                </AdminButton>
              </Stack>
            </Paper>
          </Collapse>

          {/* Quick Action Chips */}
          {pendingCounts && (
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
              {pendingCounts.inviteRequests > 0 && (
                <Chip
                  icon={<PersonAdd />}
                  label={`${pendingCounts.inviteRequests} invite requests`}
                  size="small"
                  color="warning"
                  onClick={() => setLocation('/admin/invite-system')}
                  sx={{ cursor: 'pointer' }}
                />
              )}
              {pendingCounts.prototypeFeedback > 0 && (
                <Chip
                  icon={<Feedback />}
                  label={`${pendingCounts.prototypeFeedback} feedback items`}
                  size="small"
                  color="info"
                  onClick={() => setLocation('/admin?tab=5')}
                  sx={{ cursor: 'pointer' }}
                />
              )}
              {pendingCounts.bugReports > 0 && (
                <Chip
                  icon={<BugReport />}
                  label={`${pendingCounts.bugReports} bug reports`}
                  size="small"
                  color="error"
                  onClick={() => setLocation('/admin?tab=5')}
                  sx={{ cursor: 'pointer' }}
                />
              )}
            </Stack>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Activity Content */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Alert severity="error">Failed to load activity feed</Alert>
        ) : activities.length === 0 ? (
          <Alert severity="info">No activities match your filters</Alert>
        ) : (
          <>
            {viewMode === 'list' ? renderListView() : renderTimelineView()}

            {/* Show More / View All */}
            {hasMore && (
              <Box sx={{ mt: 2, textAlign:'center' }}>
                <AdminButton
                  tone="secondary"
                  size="small"
                  onClick={() => setLocation('/admin/activity-feed-full')}
                  endIcon={<ArrowForward />}
                >
                  View All {total} Activities
                </AdminButton>
              </Box>
            )}
          </>
        )}
      </CardContent>

      {/* Activity Details Dialog */}
      <Dialog open={!!selectedActivity} onClose={() => setSelectedActivity(null)} maxWidth="sm" fullWidth>
        {selectedActivity && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar sx={{ bgcolor: `${getActivityColor(selectedActivity.type)}20` }}>
                  {getActivityIcon(selectedActivity.type)}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedActivity.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedActivity.user.name} • {formatTimestamp(selectedActivity.timestamp)}
                  </Typography>
                </Box>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedActivity.description}
              </Typography>
              
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>From:</strong> {selectedActivity.user.email}
                </Typography>
                {selectedActivity.user.profession && (
                  <Typography variant="body2">
                    <strong>Profession:</strong> {selectedActivity.user.profession}
                  </Typography>
                )}
                {selectedActivity.priority && (
                  <Typography variant="body2">
                    <strong>Priority:</strong> {selectedActivity.priority.toUpperCase()}
                  </Typography>
                )}
              </Alert>
            </DialogContent>
            <DialogActions>
              <AdminButton tone="ghost" onClick={() => setSelectedActivity(null)}>Close</AdminButton>
              {selectedActivity.actionUrl && (
                <AdminButton
                  tone="primary"
                  onClick={() => {
                    setLocation(selectedActivity.actionUrl!);
                    setSelectedActivity(null);
                  }}
                >
                  View Details
                </AdminButton>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Push Notification Settings Dialog */}
      <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Push-varsler innstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <PushNotificationSettings userId={userId} showDescription={false} />
          </Box>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setPushSettingsOpen(false)}>Lukk</AdminButton>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
