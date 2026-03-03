/**
 * SEO Specialist Dashboard - integrated and typed
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add,
  Analytics,
  Assessment,
  AutoFixHigh,
  Campaign,
  CheckCircle,
  People,
  Refresh,
  Search,
  TrendingUp,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDemoMode } from '../../contexts/DemoModeContext';

interface SEOSpecialistDashboardProps {
  specialistId?: string;
}

interface SEOClient {
  id: string;
  name: string;
  website: string;
  status: 'active' | 'pending' | 'inactive';
  nextReport?: string;
  monthlyReports?: number;
}

interface SEOCampaign {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'paused';
  keywordsTracked: number;
  rankingChange: number;
}

interface DashboardStats {
  clientCount: number;
  campaignCount: number;
  monthlyRevenueNok: number;
  avgRankingImprovement: number;
}

interface KeywordTrend {
  keyword: string;
  trend: 'rising' | 'stable' | 'falling';
  searchVolume: number;
  competition: 'low' | 'medium' | 'high';
  opportunity: string;
}

const fallbackClients: SEOClient[] = [
  {
    id: 'client-1',
    name: 'Nordic Studio',
    website: 'nordicstudio.no',
    status: 'active',
    nextReport: '2026-03-07',
    monthlyReports: 4,
  },
  {
    id: 'client-2',
    name: 'Oslo Wedding Films',
    website: 'osloweddingfilms.no',
    status: 'pending',
    nextReport: '2026-03-10',
    monthlyReports: 2,
  },
];

const fallbackCampaigns: SEOCampaign[] = [
  {
    id: 'campaign-1',
    name: 'Wedding SEO Sprint',
    status: 'active',
    keywordsTracked: 46,
    rankingChange: 3.1,
  },
  {
    id: 'campaign-2',
    name: 'Commercial Video Growth',
    status: 'pending',
    keywordsTracked: 29,
    rankingChange: 1.4,
  },
];

const fallbackTrends: KeywordTrend[] = [
  {
    keyword: 'bryllupsfotograf oslo',
    trend: 'rising',
    searchVolume: 2200,
    competition: 'medium',
    opportunity: 'high',
  },
  {
    keyword: 'videograf norge',
    trend: 'stable',
    searchVolume: 1400,
    competition: 'low',
    opportunity: 'medium',
  },
  {
    keyword: 'kommersiell filmproduksjon',
    trend: 'rising',
    searchVolume: 900,
    competition: 'high',
    opportunity: 'medium',
  },
];

const getStatusColor = (
  status: SEOClient['status'] | SEOCampaign['status'],
): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'inactive' || status === 'paused') return 'error';
  return 'default';
};

export default function SEOSpecialistDashboardIntegrated({
  specialistId = 'demo-specialist',
}: SEOSpecialistDashboardProps): React.ReactElement {
  const queryClient = useQueryClient();
  const { isDemoMode } = useDemoMode();

  const [activeTab, setActiveTab] = useState(0);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWebsite, setNewClientWebsite] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');

  const {
    data: clients = fallbackClients,
    isLoading: clientsLoading,
    error: clientsError,
  } = useQuery<SEOClient[]>({
    queryKey: ['/api/seo/clients', specialistId],
    queryFn: async () => {
      const response = await apiRequest(`/api/seo/clients?specialistId=${encodeURIComponent(specialistId)}`);
      const payload = response as { clients?: SEOClient[] } | SEOClient[];
      return Array.isArray(payload) ? payload : payload.clients ?? fallbackClients;
    },
  });

  const {
    data: campaigns = fallbackCampaigns,
    isLoading: campaignsLoading,
    error: campaignsError,
  } = useQuery<SEOCampaign[]>({
    queryKey: ['/api/seo/campaigns', specialistId],
    queryFn: async () => {
      const response = await apiRequest(`/api/seo/campaigns?specialistId=${encodeURIComponent(specialistId)}`);
      const payload = response as { campaigns?: SEOCampaign[] } | SEOCampaign[];
      return Array.isArray(payload) ? payload : payload.campaigns ?? fallbackCampaigns;
    },
  });

  const { data: trends = fallbackTrends } = useQuery<KeywordTrend[]>({
    queryKey: ['/api/seo/trends', specialistId],
    queryFn: async () => {
      const response = await apiRequest(`/api/seo/trends?specialistId=${encodeURIComponent(specialistId)}`);
      const payload = response as { trends?: KeywordTrend[] } | KeywordTrend[];
      return Array.isArray(payload) ? payload : payload.trends ?? fallbackTrends;
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (payload: { name: string; website: string }) => {
      return apiRequest('/api/seo/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, specialistId }),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/seo/clients', specialistId] });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      return apiRequest('/api/seo/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, specialistId }),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', specialistId] });
    },
  });

  const stats: DashboardStats = useMemo(() => {
    const monthlyRevenueNok = 45000;
    const avgRankingImprovement =
      campaigns.length > 0
        ? campaigns.reduce((sum, campaign) => sum + campaign.rankingChange, 0) / campaigns.length
        : 0;
    return {
      clientCount: clients.length,
      campaignCount: campaigns.length,
      monthlyRevenueNok,
      avgRankingImprovement,
    };
  }, [campaigns, clients.length]);

  const isLoading = clientsLoading || campaignsLoading;
  const hasError = Boolean(clientsError || campaignsError);

  const refreshAll = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/seo/clients', specialistId] }),
      queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', specialistId] }),
      queryClient.invalidateQueries({ queryKey: ['/api/seo/trends', specialistId] }),
    ]);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <CircularProgress />
        <Typography sx={{ ml: 1.5 }}>Loading SEO Dashboard...</Typography>
      </Box>
    );
  }

  if (hasError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load SEO dashboard data.
        <Button size="small" sx={{ ml: 1 }} onClick={() => void refreshAll()}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          SEO Specialist Dashboard
          {isDemoMode ? <Chip label="DEMO MODE" color="warning" size="small" sx={{ ml: 1 }} /> : null}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage SEO clients, campaigns, keyword opportunities and reporting.
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5">{stats.clientCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Clients
                  </Typography>
                </Box>
                <People color="primary" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5">{stats.campaignCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Campaigns
                  </Typography>
                </Box>
                <Campaign color="secondary" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5">{stats.monthlyRevenueNok.toLocaleString('no-NO')} NOK</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Revenue
                  </Typography>
                </Box>
                <Assessment color="success" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h5">+{stats.avgRankingImprovement.toFixed(1)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Rank Gain
                  </Typography>
                </Box>
                <TrendingUp color="warning" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Tabs value={activeTab} onChange={(_event, value: number) => setActiveTab(value)}>
              <Tab label="Clients" icon={<People />} iconPosition="start" />
              <Tab label="Campaigns" icon={<Campaign />} iconPosition="start" />
              <Tab label="Analytics" icon={<Analytics />} iconPosition="start" />
              <Tab label="Trends" icon={<Search />} iconPosition="start" />
              <Tab label="Reports" icon={<Assessment />} iconPosition="start" />
            </Tabs>

            <Stack direction="row" spacing={1}>
              <Button startIcon={<Refresh />} onClick={() => void refreshAll()}>
                Refresh
              </Button>
              <Button startIcon={<Add />} variant="contained" onClick={() => setShowAddClient(true)}>
                Add Client
              </Button>
              <Button startIcon={<Add />} variant="outlined" onClick={() => setShowAddCampaign(true)}>
                Add Campaign
              </Button>
            </Stack>
          </Stack>

          {activeTab === 0 ? (
            <List>
              {clients.map((client) => (
                <ListItem key={client.id} divider>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary={client.name}
                    secondary={`${client.website} • Next report: ${client.nextReport ?? 'N/A'}`}
                  />
                  <Chip label={client.status} size="small" color={getStatusColor(client.status)} />
                </ListItem>
              ))}
            </List>
          ) : null}

          {activeTab === 1 ? (
            <List>
              {campaigns.map((campaign) => (
                <ListItem key={campaign.id} divider>
                  <ListItemIcon>
                    <Campaign color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={campaign.name}
                    secondary={`${campaign.keywordsTracked} keywords tracked`}
                  />
                  <Chip
                    label={`${campaign.rankingChange >= 0 ? '+' : ''}${campaign.rankingChange.toFixed(1)} rank`}
                    size="small"
                    color={campaign.rankingChange >= 0 ? 'success' : 'error'}
                  />
                </ListItem>
              ))}
            </List>
          ) : null}

          {activeTab === 2 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Client Performance
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Average Ranking Improvement: +{stats.avgRankingImprovement.toFixed(2)} positions
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, stats.avgRankingImprovement * 15)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Revenue Analytics
                    </Typography>
                    <Typography variant="body2">This Month: {stats.monthlyRevenueNok.toLocaleString('no-NO')} NOK</Typography>
                    <Typography variant="body2" color="success.main">
                      Growth: +18.4%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : null}

          {activeTab === 3 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Trending Keywords
                    </Typography>
                    <List dense>
                      {trends.slice(0, 6).map((keyword) => (
                        <ListItem key={keyword.keyword}>
                          <ListItemIcon>
                            <TrendingUp color={keyword.trend === 'rising' ? 'success' : 'info'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={keyword.keyword}
                            secondary={`${keyword.searchVolume} searches • ${keyword.opportunity} opportunity`}
                          />
                          <Chip label={keyword.competition} size="small" color={keyword.competition === 'low' ? 'success' : 'warning'} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      SEO Quick Actions
                    </Typography>
                    <Stack spacing={1.5}>
                      <Button variant="contained" startIcon={<AutoFixHigh />}>
                        Apply SEO Fixes
                      </Button>
                      <Button variant="outlined" startIcon={<Analytics />}>
                        Export Opportunity Report
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : null}

          {activeTab === 4 ? (
            <Grid container spacing={2}>
              {clients.map((client) => (
                <Grid item xs={12} md={6} key={`${client.id}-report`}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1">{client.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Next report: {client.nextReport ?? 'N/A'}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" startIcon={<Assessment />}>
                          Generate
                        </Button>
                        <Button size="small" startIcon={<CheckCircle />}>
                          Send
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={showAddClient} onClose={() => setShowAddClient(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add SEO Client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Client Name"
              value={newClientName}
              onChange={(event) => setNewClientName(event.target.value)}
              fullWidth
            />
            <TextField
              label="Website"
              value={newClientWebsite}
              onChange={(event) => setNewClientWebsite(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddClient(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              void createClientMutation.mutateAsync({ name: newClientName, website: newClientWebsite });
              setNewClientName('');
              setNewClientWebsite('');
              setShowAddClient(false);
            }}
            disabled={newClientName.trim().length === 0 || newClientWebsite.trim().length === 0}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showAddCampaign} onClose={() => setShowAddCampaign(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add SEO Campaign</DialogTitle>
        <DialogContent>
          <TextField
            label="Campaign Name"
            value={newCampaignName}
            onChange={(event) => setNewCampaignName(event.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddCampaign(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              void createCampaignMutation.mutateAsync({ name: newCampaignName });
              setNewCampaignName('');
              setShowAddCampaign(false);
            }}
            disabled={newCampaignName.trim().length === 0}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
