/**
 * ScrollStory Settings Panel
 * Comprehensive control panel for managing ScrollStory features, privacy, and analytics
 * Includes advanced analytics dashboard, comment system toggle, and performance metrics
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Settings,
  Analytics,
  Comment,
  Visibility,
  Lock,
  Speed,
  Person,
  Timeline,
  TrendingUp,
  Close,
  Info,
  CheckCircle,
  Warning,
  Refresh,
  Language,
  Public,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface ScrollStorySettings {
  // Privacy & Access
  commentsEnabled: boolean;
  publicAccess: boolean;
  requireLogin: boolean;
  allowEmbedding: boolean;

  // Features
  audioNarrationEnabled: boolean;
  videoTransitionsEnabled: boolean;
  parallaxEnabled: boolean;
  keyboardNavEnabled: boolean;

  // Performance
  mediaPreloading: boolean;
  svgRenderingEnabled: boolean;
  autoPlayVideos: boolean;

  // Analytics
  trackingEnabled: boolean;
  detailedAnalytics: boolean;

  // Localization
  language: string;
  autoDetectLanguage: boolean;
}

interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  avgScrollDepth: number;
  avgTimeSpent: number;
  completionRate: number;
  bounceRate: number;
  topPages: Array<{ pageId: string; title: string; views: number }>;
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  hourlyViews: number[];
  engagementScore: number;
}

interface ScrollStorySettingsPanelProps {
  open: boolean;
  onClose: () => void;
  storyId: string;
  storyName: string;
  currentSettings: ScrollStorySettings;
  onSettingsChange: (settings: ScrollStorySettings) => void;
}

export default function ScrollStorySettingsPanel({
  open,
  onClose,
  storyId,
  storyName,
  currentSettings,
  onSettingsChange,
}: ScrollStorySettingsPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState<ScrollStorySettings>(currentSettings);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { analytics: analyticsService, features } = useEnhancedMasterIntegration();

  useEffect(() => {
    if (open && activeTab === 1) {
      loadAnalytics();
    }
  }, [open, activeTab]);

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch(`/api/scroll-stories/${storyId}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load analytics: ', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleSettingChange = (key: keyof ScrollStorySettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasChanges(true);

    analyticsService.trackEvent('scroll_story_setting_changed', {
      storyId,
      setting: key,
      value,
    });
  };

  const handleSave = () => {
    onSettingsChange(settings);
    setHasChanges(false);

    analyticsService.trackEvent('scroll_story_settings_saved', {
      storyId,
      settings,
    });

    features.trackFeatureUsage('scroll-story', 'settings-saved', {
      storyId,
    });
  };

  const handleReset = () => {
    setSettings(currentSettings);
    setHasChanges(false);
  };

  const SettingsTab = () => (
    <Box>
      {/* Privacy & Access Section */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <Lock /> Privacy & Access
        </Typography>
        <Card variant="outlined">
          <CardContent>
            <List>
              <ListItem>
                <ListItemText
                  primary="Enable Comments"
                  secondary="Allow viewers to leave comments on story pages"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.commentsEnabled}
                    onChange={(e) => handleSettingChange('commentsEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Public Access"
                  secondary="Make story visible to anyone with the link"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.publicAccess}
                    onChange={(e) => handleSettingChange('publicAccess', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Require Login"
                  secondary="Viewers must be logged in to view story"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.requireLogin}
                    onChange={(e) => handleSettingChange('requireLogin', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Allow Embedding"
                  secondary="Story can be embedded on other websites"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.allowEmbedding}
                    onChange={(e) => handleSettingChange('allowEmbedding', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Features Section */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <Settings /> Features
        </Typography>
        <Card variant="outlined">
          <CardContent>
            <List>
              <ListItem>
                <ListItemText
                  primary="Audio Narration"
                  secondary="Enable synchronized audio narration"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.audioNarrationEnabled}
                    onChange={(e) => handleSettingChange('audioNarrationEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Video Transitions"
                  secondary="Smooth transitions between video segments"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.videoTransitionsEnabled}
                    onChange={(e) =>
                      handleSettingChange('videoTransitionsEnabled', e.target.checked)
                    }
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Parallax Effects"
                  secondary="Enable parallax scrolling animations"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.parallaxEnabled}
                    onChange={(e) => handleSettingChange('parallaxEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Keyboard Navigation"
                  secondary="Allow navigation with arrow keys"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.keyboardNavEnabled}
                    onChange={(e) => handleSettingChange('keyboardNavEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Performance Section */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <Speed /> Performance
        </Typography>
        <Card variant="outlined">
          <CardContent>
            <List>
              <ListItem>
                <ListItemText
                  primary="Media Preloading"
                  secondary="Preload images and videos for smoother playback"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.mediaPreloading}
                    onChange={(e) => handleSettingChange('mediaPreloading', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="SVG Rendering (40x faster)"
                  secondary="Use high-performance SVG to PNG conversion"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.svgRenderingEnabled}
                    onChange={(e) => handleSettingChange('svgRenderingEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Auto-Play Videos"
                  secondary="Automatically play videos when in viewport"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.autoPlayVideos}
                    onChange={(e) => handleSettingChange('autoPlayVideos', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Analytics Section */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
          <Analytics /> Analytics & Tracking
        </Typography>
        <Card variant="outlined">
          <CardContent>
            <List>
              <ListItem>
                <ListItemText
                  primary="Enable Tracking"
                  secondary="Track views, scrolls, and interactions"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.trackingEnabled}
                    onChange={(e) => handleSettingChange('trackingEnabled', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Detailed Analytics"
                  secondary="Track detailed user behavior and engagement"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={settings.detailedAnalytics}
                    onChange={(e) => handleSettingChange('detailedAnalytics', e.target.checked)}
                    disabled={!settings.trackingEnabled}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>

      {hasChanges && (
        <Alert severity="warning" icon={<Warning />}>
          You have unsaved changes. Click "Save Changes" to apply them.
        </Alert>
      )}
    </Box>
  );

  const AnalyticsTab = () => (
    <Box>
      {loadingAnalytics ? (
        <Box display="flex" justifyContent="center" py={4}>
          <LinearProgress sx={{ width: '50%' }} />
        </Box>
      ) : analytics ? (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Views
                      </Typography>
                      <Typography variant="h4">{analytics.totalViews.toLocaleString()}</Typography>
                    </Box>
                    <Visibility color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Unique Visitors
                      </Typography>
                      <Typography variant="h4">
                        {analytics.uniqueVisitors.toLocaleString()}
                      </Typography>
                    </Box>
                    <Person color="secondary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Completion Rate
                      </Typography>
                      <Typography variant="h4">{analytics.completionRate}%</Typography>
                    </Box>
                    <CheckCircle color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Avg. Time Spent
                      </Typography>
                      <Typography variant="h4">
                        {Math.floor(analytics.avgTimeSpent / 60)}m
                      </Typography>
                    </Box>
                    <Timeline color="info" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Engagement Metrics */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Engagement Metrics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Average Scroll Depth
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <LinearProgress
                        variant="determinate"
                        value={analytics.avgScrollDepth}
                        sx={{ flex: 1, height: 8, borderRadius: 4 }} />
                      <Typography variant="body2" fontWeight="bold">
                        {analytics.avgScrollDepth}%
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Bounce Rate
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2}>
                      <LinearProgress
                        variant="determinate"
                        value={analytics.bounceRate}
                        color={analytics.bounceRate > 50 ? 'error' : 'success'}
                        sx={{ flex: 1, height: 8, borderRadius: 4 }} />
                      <Typography variant="body2" fontWeight="bold">
                        {analytics.bounceRate}%
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Engagement Score
                    </Typography>
                    <Typography variant="h3" color="primary">
                      {analytics.engagementScore}/100
                    </Typography>
                    <Chip
                      label={
                        analytics.engagementScore >= 80
                          ? 'Excellent'
                          : analytics.engagementScore >= 60
                            ? 'Good'
                            : 'Needs Improvement'
                      }
                      color={
                        analytics.engagementScore >= 80
                          ? 'success'
                          : analytics.engagementScore >= 60
                            ? 'primary' : 'warning'
                      }
                      size="small"
                      sx={{ mt: 1 }} />
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Top Pages */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Most Viewed Pages
              </Typography>
              <List>
                {analytics.topPages.map((page, index) => (
                  <React.Fragment key={page.pageId}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={page.title}
                        secondary={`${page.views.toLocaleString()} views`}
                      />
                      <Chip label={`#${index + 1}`} size="small" />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Device Breakdown */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Breakdown
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {analytics.deviceBreakdown.mobile}%
                    </Typography>
                    <Typography variant="caption">Mobile</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="secondary">
                      {analytics.deviceBreakdown.desktop}%
                    </Typography>
                    <Typography variant="caption">Desktop</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">
                      {analytics.deviceBreakdown.tablet}%
                    </Typography>
                    <Typography variant="caption">Tablet</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </>
      ) : (
        <Alert severity="info">
          No analytics data available yet. Enable tracking in settings to start collecting data.
        </Alert>
      )}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Settings />
            <Typography variant="h6">ScrollStory Settings</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {storyName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
          <Tab label="Settings" icon={<Settings />} iconPosition="start" />
          <Tab label="Analytics" icon={<TrendingUp />} iconPosition="start" />
        </Tabs>

        {activeTab === 0 && <SettingsTab />}
        {activeTab === 1 && <AnalyticsTab />}
      </DialogContent>

      <DialogActions>
        {activeTab === 0 ? (
          <>
            <Button onClick={handleReset} disabled={!hasChanges}>
              Reset
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!hasChanges}
              startIcon={<CheckCircle />}
            >
              Save Changes
            </Button>
          </>
        ) : (
          <>
            <Button startIcon={<Refresh />} onClick={loadAnalytics}>
              Refresh
            </Button>
            <Button onClick={onClose}>Close</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
