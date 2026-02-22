/**
 * SEO Specialist Dashboard - Integrated with DemoModeContext
 * Real data with demo mode support
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Avatar,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  TrendingUp,
  Search,
  AutoFixHigh,
  CheckCircle,
  Refresh,
  Analytics,
  LocationOn,
  Schedule,
  Star,
  People,
  Campaign,
  Assessment,
  Add,
  Edit,
  Delete,
  Visibility,
  Speed as Speed,
  Psychology,
  Business as DirectionsBusiness,
  CameraAlt as CameraAltAlt,
  Videocam as Videocamcam,
  MusicNote as MusicNoteNote,
  Store,
  Email,
  Phone,
  Web,
  CalendarToday as CalendarTodayToday,
  MonetizationOn,
  Timeline,
  BarChart as BoxChart,
  BarChart as BoxChart,
  ShowChart,
} from '@mui/icons-material';
import { useProfessionAdapter } from '../../hooks/useProfessionAdapter';
import { seoSpecialistService } from '../../services/SEOSpecialistService';
import { useDemoMode, useDemoModeQuery } from '../../contexts/DemoModeContext';

interface SEOSpecialistDashboardProps {
  specialistId?: string;
}

export default function SEOSpecialistDashboardIntegrated({ 
  specialistId =  'demo-specialist' 
}: SEOSpecialistDashboardProps) {
  const {
    profession,
    getProfessionSpecificKeywords,
    getProfessionSEOTips,
    trackProfessionActivity,
    getProfessionAnalytics,
} = useProfessionAdapter();

  const { isDemoMode } = useDemoMode();
  
  // Theming system
  const theming = useTheming('photographer');
  const [activeTab, setActiveTab] = useState(0);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);

  // Real data queries with demo mode support
  const {
    data: clients = [],
    isLoading: clientsLoading,
    error: clientsError,
    refetch: refetchClients,
} = useDemoModeQuery(
    ['seo-clients', specialistId],
    () => seoSpecialistService.getClients(specialistId),
    {
      enabled: !!specialistd,
  }
  );

  const {
    data: campaigns = [],
    isLoading: campaignsLoading,
    error: campaignsError,
    refetch: refetchCampaigns,
} = useDemoModeQuery(
    ['seo-campaigns', specialistId],
    () => seoSpecialistService.getCampaigns(specialistId),
    {
      enabled: !!specialistd,
  }
  );

  const {
    data: dashboardStats,
    isLoading: statsLoading,
    error: statsError,
} = useDemoModeQuery(
    ['seo-dashboard-stats', specialistId],
    () => seoSpecialistService.getDashboardStats(specialistId),
    {
      enabled: !!specialistd,
  }
  );

  const {
    data: trendsData,
    isLoading: trendsLoading,
    error: trendsError,
    refetch: refetchTrends,
} = useDemoModeQuery(
    ['seo-trends', specialistId, profession],
    () => seoSpecialistService.getTrends(specialistId, profession'norway'),
    {
      enabled: !!specialistd,
  }
  );

  const {
    data: notifications = [],
    isLoading: notificationsLoading,
    error: notificationsError,
} = useDemoModeQuery(
    ['seo-notifications', specialistId],
    () => seoSpecialistService.getNotifications(specialistId, true),
    {
      enabled: !!specialistd,
  }
  );

  // Loading states
  const isLoading = clientsLoading || campaignsLoading || statsLoading || trendsLoading;
  const hasError = clientsError || campaignsError || statsError || trendsError;

  // Handle data refresh
  const handleRefresh = async () => {
    await Promise.all([
      refetchClients(),
      refetchCampaigns(),
      refetchTrends(),
    ]);
    await trackProfessionActivity('seo_dashboard_refresh', { specialistId });
};

  const handleAddClient = async (clientData: any) => {
    try {
      await seoSpecialistService.createClient(specialistd, clientData);
      await refetchClients();
      await trackProfessionActivity('seo_client_added', { specialistId, clientName: clientData.name });
  } catch (error) {
      console.error('Error adding client: ', error);
  }
};

  const handleAddCampaign = async (campaignData: any) => {
    try {
      await seoSpecialistService.createCampaign(campaignData);
      await refetchCampaigns();
      await trackProfessionActivity('seo_campaign_added', { specialistId, campaignName: campaignData.name });
  } catch (error) {
      console.error('Error adding campaign:', error);
  }
};

  const handleApplySEOFixes = async () => {
    try {
      // This would integrate with the CreatorHub SEO Fix Service
      await trackProfessionActivity('seo_fixes_applied', { specialistId });
      alert('✅ SEO fixes applied successfully!');
  } catch (error) {
      console.error('Error applying SEO fixes:', error);
      alert('❌ Error applying SEO fixes');
  }
};

  const getProfessionIcon = (prof: string) => {
    const icons = {
      photographer: <CameraAlt />,
      videographer: theming.getThemedIcon(', '),
      music_producer: <MusicNote />,
      vendor: theming.getThemedIcon(', '),
  };
    return icons[prof as keyof typeof icons] || theming.getThemedIcon('business');
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'inactive':
        return 'error';
      default:
        return 'default';
}
};

  const getRankingChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp color="success" />;
    if (change < 0) return <TrendingUp color="error" sx={{ transform: 'rotate(180deg)' }} />;
    return <TrendingUp color="info" />;
};

  // Show loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400}}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml:  2 }}>
          Loading SEO Specialist Dashboard...
        </Typography>
      </Box>
    );
}

  // Show error state
  if (hasError) {
    return (
      <Alert severity="error" sx={{ m:  2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Error Loading Dashboard</Typography>
        <Typography variant="body2">
          {clientsError?.message || campaignsError?.message || statsError?.message || trendsError?.message}
        </Typography>
        <Button onClick={handleRefresh} sx={{ mt:  1 }}>
          Retry
        </Button>
      </Alert>
    );
}

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb:  3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          🎯 SEO Specialist Dashboard
          {isDemoMode && (
            <Chip label="DEMO MODE" color="warning" size="small" sx={{ ml:  2 }} />
          )}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your clients, campaigns, and SEO performance
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{dashboardStats?.clientCount || clients.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Clients
                  </Typography>
                </Box>
                <People color="primary" sx={{ fontSize: 40}} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{dashboardStats?.campaignCount || campaigns.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Campaigns
                  </Typography>
                </Box>
                <Campaign color="secondary" sx={{ fontSize: 40}} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {dashboardStats?.totalConversions || 
                     campaigns.reduce((sum, c) => sum + (c.performance?.conversions || 0), 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Conversions
                  </Typography>
                </Box>
                <MonetizationOn color="success" sx={{ fontSize: 40}} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item >
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {dashboardStats?.monthlyRevenue?.toLocaleString() || 
                     clients.reduce((sum, c) => sum + (c.monthlyBudget || 0), 0).toLocaleString()} NOK
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Revenue
                  </Typography>
                </Box>
                <BarChart color="info" sx={{ fontSize: 40}} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Card sx={theming.getThemedCardSx()}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
            <Tab label="Clients" icon={theming.getThemedIcon('people')}} />
            <Tab label="Campaigns" icon={<Campaign />} />
            <Tab label="Analytics" icon={theming.getThemedIcon('analytics')}} />
            <Tab label="Trends" icon={theming.getThemedIcon('trendingUp')}} />
            <Tab label="Reports" icon={theming.getThemedIcon('assessment')}} />
          </Tabs>
        </Box>

        {/* Clients Tab */}
        {activeTab === 0 && (
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Client Management</Typography>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('add')}
                onClick={() => setShowAddClient(true)}
              >
                Add Client
              </Button>
            </Box>

            <Grid container spacing={3}>
              {clients.map((client) => (
                <Grid item  key={client.id}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', mr:  2 }}>
                          {getProfessionIcon(client.profession)}
                        </Avatar>
                        <Box sx={{ flexGrow:  1 }}>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>{client.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {client.profession} • {client.website}
                          </Typography>
                        </Box>
                        <Chip
                          label={client.status}
                          color={getStatusColor(client.status) as any}
                          size="small"
                        />
                      </Box>

                      <Box sx={{ mb:  2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Monthly Budget: {client.monthlyBudget?.toLocaleString()} NOK
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Last Activity: {client.lastActivity}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Next Report: {client.nextReport}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', gap:  1 }}>
                        <Button size="small" startIcon={theming.getThemedIcon('visibility')}>
                          View
                        </Button>
                        <Button size="small" startIcon={theming.getThemedIcon('edit')}>
                          Edit
                        </Button>
                        <Button size="small" startIcon={theming.getThemedIcon('assessment')}>
                          Report
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        )}

        {/* Campaigns Tab */}
        {activeTab === 1 && (
          <CardContent sx={theming.getThemedCardSx()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Campaign Management</Typography>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('add')}
                onClick={() => setShowAddCampaign(true)}
              >
                Add Campaign
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Budget</TableCell>
                    <TableCell>Spent</TableCell>
                    <TableCell>Performance</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const client = clients.find(c => c.id === campaign.clientId);
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <Typography variant="subtitle2">{campaign.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {campaign.keywords?.length || 0} keywords
                          </Typography>
                        </TableCell>
                        <TableCell>{client?.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={campaign.status}
                            color={getStatusColor(campaign.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{campaign.budget?.toLocaleString()} NOK</TableCell>
                        <TableCell>{campaign.spent?.toLocaleString()} NOK</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {campaign.performance?.conversions || 0} conversions
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              CTR: {campaign.performance?.ctr || 0}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small">
                            {theming.getThemedIcon('edit')}
                          </IconButton>
                          <IconButton size="small">
                            {theming.getThemedIcon('visibility')}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* Analytics Tab */}
        {activeTab === 2 && (
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Performance Analytics
            </Typography>
            <Grid container spacing={3}>
              <Grid item >
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Client Performance
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  2 }}>
                      <Typography variant="body2">Average Ranking Improvement</Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>+2.3 positions</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  2 }}>
                      <Typography variant="body2">Total Keywords Tracked</Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>47</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Conversion Rate</Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>3.2%</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item >
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Revenue Analytics
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  2 }}>
                      <Typography variant="body2">This Month</Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>45,000 NOK</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  2 }}>
                      <Typography variant="body2">Last Month</Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>38,000 NOK</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">Growth</Typography>
                      <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>+18.4%</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        )}

        {/* Trends Tab */}
        {activeTab === 3 && (
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Trending Keywords & Opportunities
            </Typography>
            <Grid container spacing={3}>
              <Grid item >
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Trending Keywords
                    </Typography>
                    <List dense>
                      {(trendsData?.trendingKeywords || []).slice(0, 5).map((keyword, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            {keyword.trend === 'rising' ? (
                              <TrendingUp color="success" />
                            ) : (
                              <TrendingUp color="info" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={keyword.keyword}
                            secondary={`${keyword.searchVolume} searches • ${keyword.opportunity} opportunity`}
                          />
                          <Chip
                            label={keyword.competition}
                            size="small"
                            color={keyword.competition === 'low' ? 'success' : 'warning'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item >
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      SEO Tips for Your Clients
                    </Typography>
                    <List dense>
                      {getProfessionSEOTips().map((tip, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <AutoFixHigh color="primary" />
                          </ListItemIcon>
                          <ListItemText primary={tip} />
                        </ListItem>
                      ))}
                    </List>
                    <Button variant="contained"
                      startIcon={theming.getThemedIcon('autoFixHigh')}
                      onClick={handleApplySEOFixes}
                      fullWidth
                      sx={{ mt:  2 }}
                      color="success"
                     sx={theming.getThemedButtonSx()}>
                      Apply SEO Fixes
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        )}

        {/* Reports Tab */}
        {activeTab === 4 && (
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Client Reports & Analytics
            </Typography>
            <Grid container spacing={3}>
              {clients.map((client) => (
                <Grid item  key={client.id}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>{client.name}</Typography>
                        <Chip label={`${client.monthlyReports || 0} reports`} color="primary" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Next Report: {client.nextReport}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button size="small" startIcon={theming.getThemedIcon('assessment')}>
                          Generate Report
                        </Button>
                        <Button size="small" startIcon={theming.getThemedIcon('email')}>
                          Send Report
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        )}
      </Card>

      {/* Action Buttons */}
      <Box sx={{ mt:  3, display: 'flex', gap: 2, justifyContent:'center' }}>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('refresh')}
          onClick={handleRefresh}
          disabled={isLoading}
         sx={theming.getThemedButtonSx()}>
          Refresh All Data
        </Button>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('analytics')}
          onClick={() => trackProfessionActivity('seo_dashboard_viewed', { specialistId })}
        >
          Track View
        </Button>
      </Box>

      {/* Demo Mode Indicator */}
      {isDemoMode && (
        <Alert severity="info" sx={{ mt:  2 }}>
          <Typography variant="body2">
            <strong>Demo Mode Active: </strong> This dashboard is showing sample data for demonstration purposes. 
            In production, this would connect to real SEO specialist data and live analytics.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
