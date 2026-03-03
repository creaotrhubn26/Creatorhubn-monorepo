import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
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
import Grid from '@mui/material/Grid';
import {
  Add,
  AutoFixHigh,
  Campaign,
  CheckCircle,
  Email,
  MonetizationOn,
  Phone,
  Refresh,
  Search,
  ShowChart,
  Speed,
  Timeline,
  Web,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SEOClient {
  id: string;
  name: string;
  profession: string;
  email: string;
  phone: string;
  website: string;
  status: 'active' | 'inactive' | 'pending';
  monthlyBudget: number;
  startDate: string;
  lastActivity: string;
  keywords: string[];
}

interface SEOCampaign {
  id: string;
  clientId: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  budget: number;
  spent: number;
  startDate: string;
  endDate?: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface SEONotification {
  id: string;
  severity: 'info' | 'warning' | 'success';
  message: string;
  createdAt: string;
}

interface TrendPoint {
  id: string;
  keyword: string;
  currentPosition: number;
  previousPosition: number;
  volume: number;
}

interface DashboardStats {
  activeClients: number;
  activeCampaigns: number;
  monthlyBudget: number;
  avgCtr: number;
  avgConversionRate: number;
}

interface SEOSpecialistDashboardProps {
  specialistId?: string;
}

interface NewClientForm {
  name: string;
  profession: string;
  email: string;
  phone: string;
  website: string;
  monthlyBudget: string;
  keywords: string;
}

interface NewCampaignForm {
  clientId: string;
  name: string;
  budget: string;
  startDate: string;
}

const fallbackClients: SEOClient[] = [
  {
    id: 'client-1',
    name: 'Nordic Wedding Films',
    profession: 'videographer',
    email: 'hello@nordicwedding.no',
    phone: '+47 900 10 010',
    website: 'https://nordicwedding.no',
    status: 'active',
    monthlyBudget: 12000,
    startDate: '2026-01-10',
    lastActivity: '2026-02-26',
    keywords: ['wedding video norway', 'cinematic wedding film'],
  },
  {
    id: 'client-2',
    name: 'Oslo Portrait Studio',
    profession: 'photographer',
    email: 'studio@osloportrait.no',
    phone: '+47 901 22 123',
    website: 'https://osloportrait.no',
    status: 'pending',
    monthlyBudget: 8000,
    startDate: '2026-02-02',
    lastActivity: '2026-02-25',
    keywords: ['portrait photographer oslo', 'headshot oslo'],
  },
];

const fallbackCampaigns: SEOCampaign[] = [
  {
    id: 'campaign-1',
    clientId: 'client-1',
    name: 'Local SEO + Service Pages',
    status: 'active',
    budget: 10000,
    spent: 5300,
    startDate: '2026-01-12',
    endDate: '2026-04-12',
    impressions: 128000,
    clicks: 5640,
    conversions: 129,
  },
  {
    id: 'campaign-2',
    clientId: 'client-2',
    name: 'Keyword Cluster Expansion',
    status: 'paused',
    budget: 6000,
    spent: 2200,
    startDate: '2026-02-01',
    endDate: '2026-05-01',
    impressions: 62000,
    clicks: 2100,
    conversions: 41,
  },
];

const fallbackNotifications: SEONotification[] = [
  {
    id: 'note-1',
    severity: 'warning',
    message: '2 tracked keywords dropped more than 3 positions this week.',
    createdAt: '2026-02-27T08:30:00Z',
  },
  {
    id: 'note-2',
    severity: 'success',
    message: 'Core Web Vitals score improved on 4 landing pages.',
    createdAt: '2026-02-26T10:00:00Z',
  },
];

const fallbackTrends: TrendPoint[] = [
  {
    id: 'trend-1',
    keyword: 'wedding video oslo',
    currentPosition: 4,
    previousPosition: 7,
    volume: 3400,
  },
  {
    id: 'trend-2',
    keyword: 'bryllupsfilm norge',
    currentPosition: 9,
    previousPosition: 6,
    volume: 1800,
  },
  {
    id: 'trend-3',
    keyword: 'portrait photographer oslo',
    currentPosition: 3,
    previousPosition: 5,
    volume: 2100,
  },
];

async function safeApiRequest<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await apiRequest(url);
    return response as T;
  } catch {
    return fallback;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(
    value,
  );
}

function tabA11yProps(index: number) {
  return {
    id: `seo-dashboard-tab-${index}`,
    'aria-controls': `seo-dashboard-tabpanel-${index}`,
  };
}

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`seo-dashboard-tabpanel-${index}`}
      aria-labelledby={`seo-dashboard-tab-${index}`}
      sx={{ pt: 2 }}
    >
      {value === index ? children : null}
    </Box>
  );
}

export default function SEOSpecialistDashboard({ specialistId = 'demo-specialist' }: SEOSpecialistDashboardProps) {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState<NewClientForm>({
    name: '',
    profession: 'photographer',
    email: '',
    phone: '',
    website: '',
    monthlyBudget: '0',
    keywords: '',
  });
  const [newCampaign, setNewCampaign] = useState<NewCampaignForm>({
    clientId: '',
    name: '',
    budget: '0',
    startDate: '',
  });

  const clientsQuery = useQuery({
    queryKey: ['/api/seo/clients', specialistId],
    queryFn: async () =>
      safeApiRequest<SEOClient[]>(`/api/seo/clients?specialistId=${encodeURIComponent(specialistId)}`, fallbackClients),
  });

  const campaignsQuery = useQuery({
    queryKey: ['/api/seo/campaigns', specialistId],
    queryFn: async () =>
      safeApiRequest<SEOCampaign[]>(
        `/api/seo/campaigns?specialistId=${encodeURIComponent(specialistId)}`,
        fallbackCampaigns,
      ),
  });

  const notificationsQuery = useQuery({
    queryKey: ['/api/seo/notifications', specialistId],
    queryFn: async () =>
      safeApiRequest<SEONotification[]>(
        `/api/seo/notifications?specialistId=${encodeURIComponent(specialistId)}`,
        fallbackNotifications,
      ),
  });

  const trendsQuery = useQuery({
    queryKey: ['/api/seo/trends', specialistId],
    queryFn: async () =>
      safeApiRequest<TrendPoint[]>(`/api/seo/trends?specialistId=${encodeURIComponent(specialistId)}`, fallbackTrends),
  });

  const clients = clientsQuery.data ?? fallbackClients;
  const campaigns = campaignsQuery.data ?? fallbackCampaigns;
  const notifications = notificationsQuery.data ?? fallbackNotifications;
  const trends = trendsQuery.data ?? fallbackTrends;

  const stats = useMemo<DashboardStats>(() => {
    const activeClients = clients.filter((client) => client.status === 'active').length;
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active').length;
    const monthlyBudget = clients.reduce((sum, client) => sum + client.monthlyBudget, 0);

    const totals = campaigns.reduce(
      (acc, campaign) => {
        const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
        const conversionRate = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks) * 100 : 0;
        return {
          ctr: acc.ctr + ctr,
          conversionRate: acc.conversionRate + conversionRate,
          count: acc.count + 1,
        };
      },
      { ctr: 0, conversionRate: 0, count: 0 },
    );

    return {
      activeClients,
      activeCampaigns,
      monthlyBudget,
      avgCtr: totals.count > 0 ? totals.ctr / totals.count : 0,
      avgConversionRate: totals.count > 0 ? totals.conversionRate / totals.count : 0,
    };
  }, [clients, campaigns]);

  const isLoading = clientsQuery.isLoading || campaignsQuery.isLoading || notificationsQuery.isLoading || trendsQuery.isLoading;

  const createClientMutation = useMutation({
    mutationFn: async (form: NewClientForm) => {
      const payload = {
        specialistId,
        name: form.name.trim(),
        profession: form.profession,
        email: form.email.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
        monthlyBudget: Number(form.monthlyBudget) || 0,
        keywords: form.keywords
          .split(',')
          .map((keyword) => keyword.trim())
          .filter((keyword) => keyword.length > 0),
      };
      await apiRequest('/api/seo/clients', { method: 'POST', body: payload });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/seo/clients', specialistId] });
      setClientDialogOpen(false);
      setNewClient({
        name: '',
        profession: 'photographer',
        email: '',
        phone: '',
        website: '',
        monthlyBudget: '0',
        keywords: '',
      });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (form: NewCampaignForm) => {
      const payload = {
        specialistId,
        clientId: form.clientId,
        name: form.name.trim(),
        budget: Number(form.budget) || 0,
        startDate: form.startDate,
      };
      await apiRequest('/api/seo/campaigns', { method: 'POST', body: payload });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', specialistId] });
      setCampaignDialogOpen(false);
      setNewCampaign({ clientId: '', name: '', budget: '0', startDate: '' });
    },
  });

  const applyAutoFixMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/admin/apply-seo-fixes', {
        method: 'POST',
        body: { specialistId, scope: 'dashboard' },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/seo/clients', specialistId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/seo/campaigns', specialistId] }),
        queryClient.invalidateQueries({ queryKey: ['/api/seo/trends', specialistId] }),
      ]);
    },
  });

  const handleRefresh = async () => {
    await Promise.all([
      clientsQuery.refetch(),
      campaignsQuery.refetch(),
      notificationsQuery.refetch(),
      trendsQuery.refetch(),
    ]);
  };

  const openClientDialog = () => {
    setClientDialogOpen(true);
  };

  const openCampaignDialog = () => {
    const preferredClientId = clients.length > 0 ? clients[0].id : '';
    setNewCampaign((current) => ({ ...current, clientId: current.clientId || preferredClientId }));
    setCampaignDialogOpen(true);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            SEO Specialist Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Specialist: {specialistId}
          </Typography>
        </Box>

        <Stack direction="row" gap={1}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={handleRefresh}>
            Refresh
          </Button>
          <Button startIcon={<Add />} variant="outlined" onClick={openClientDialog}>
            Add Client
          </Button>
          <Button startIcon={<Campaign />} variant="contained" onClick={openCampaignDialog}>
            Add Campaign
          </Button>
        </Stack>
      </Stack>

      {isLoading ? <LinearProgress sx={{ mt: 2 }} /> : null}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Active Clients
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {stats.activeClients}
                  </Typography>
                </Box>
                <Avatar>
                  <CheckCircle />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Active Campaigns
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {stats.activeCampaigns}
                  </Typography>
                </Box>
                <Avatar>
                  <Campaign />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Budget
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(stats.monthlyBudget)}
                  </Typography>
                </Box>
                <Avatar>
                  <MonetizationOn />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Avg CTR / CVR
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {stats.avgCtr.toFixed(2)}% / {stats.avgConversionRate.toFixed(2)}%
                  </Typography>
                </Box>
                <Avatar>
                  <Speed />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} variant="scrollable" allowScrollButtonsMobile>
          <Tab label="Overview" icon={<Timeline />} iconPosition="start" {...tabA11yProps(0)} />
          <Tab label="Clients" icon={<Search />} iconPosition="start" {...tabA11yProps(1)} />
          <Tab label="Campaigns" icon={<Campaign />} iconPosition="start" {...tabA11yProps(2)} />
          <Tab label="Trends" icon={<ShowChart />} iconPosition="start" {...tabA11yProps(3)} />
          <Tab
            label={
              <Badge color="warning" badgeContent={notifications.length} max={9}>
                Alerts
              </Badge>
            }
            {...tabA11yProps(4)}
          />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2}>
                <Box>
                  <Typography variant="h6">SEO Automation</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Run automatic technical and content SEO fixes for connected projects.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<AutoFixHigh />}
                  onClick={() => applyAutoFixMutation.mutate()}
                  disabled={applyAutoFixMutation.isPending}
                >
                  {applyAutoFixMutation.isPending ? 'Applying…' : 'Apply SEO Fixes'}
                </Button>
              </Stack>
              {applyAutoFixMutation.isError ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Could not run SEO auto-fix. Check backend endpoint and permissions.
                </Alert>
              ) : null}
              {applyAutoFixMutation.isSuccess ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  SEO fix pipeline completed and data has been refreshed.
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Profession</TableCell>
                    <TableCell>Budget</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Last Activity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{client.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={client.status} size="small" color={client.status === 'active' ? 'success' : client.status === 'pending' ? 'warning' : 'default'} />
                      </TableCell>
                      <TableCell>{client.profession}</TableCell>
                      <TableCell>{formatCurrency(client.monthlyBudget)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Chip icon={<Email />} label={client.email} size="small" variant="outlined" />
                          <Chip icon={<Phone />} label={client.phone} size="small" variant="outlined" />
                          <Chip icon={<Web />} label="site" size="small" variant="outlined" onClick={() => window.open(client.website, '_blank', 'noopener,noreferrer')} />
                        </Stack>
                      </TableCell>
                      <TableCell>{new Date(client.lastActivity).toLocaleDateString('nb-NO')}</TableCell>
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
                    <TableCell>Campaign</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Budget / Spent</TableCell>
                    <TableCell>Impressions</TableCell>
                    <TableCell>Clicks</TableCell>
                    <TableCell>Conversions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id} hover>
                      <TableCell>{campaign.name}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={campaign.status}
                          color={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(campaign.budget)} / {formatCurrency(campaign.spent)}
                      </TableCell>
                      <TableCell>{campaign.impressions.toLocaleString('nb-NO')}</TableCell>
                      <TableCell>{campaign.clicks.toLocaleString('nb-NO')}</TableCell>
                      <TableCell>{campaign.conversions.toLocaleString('nb-NO')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={2}>
            {trends.map((trend) => {
              const delta = trend.previousPosition - trend.currentPosition;
              const directionColor = delta > 0 ? 'success.main' : delta < 0 ? 'error.main' : 'text.secondary';
              return (
                <Grid item xs={12} md={4} key={trend.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary">
                        {trend.keyword}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        #{trend.currentPosition}
                      </Typography>
                      <Typography sx={{ color: directionColor }}>
                        {delta > 0 ? `+${delta}` : delta} positions vs previous period
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Volume: {trend.volume.toLocaleString('nb-NO')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Stack spacing={1}>
            {notifications.map((notification) => (
              <Alert key={notification.id} severity={notification.severity}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                  <Typography variant="body2">{notification.message}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(notification.createdAt).toLocaleString('nb-NO')}
                  </Typography>
                </Stack>
              </Alert>
            ))}
          </Stack>
        </TabPanel>
      </Box>

      <Dialog open={clientDialogOpen} onClose={() => setClientDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add SEO Client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Client Name"
              value={newClient.name}
              onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="seo-client-profession-label">Profession</InputLabel>
              <Select
                labelId="seo-client-profession-label"
                label="Profession"
                value={newClient.profession}
                onChange={(event) => setNewClient((current) => ({ ...current, profession: event.target.value }))}
              >
                <MenuItem value="photographer">Photographer</MenuItem>
                <MenuItem value="videographer">Videographer</MenuItem>
                <MenuItem value="music_producer">Music Producer</MenuItem>
                <MenuItem value="vendor">Vendor</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Email"
              type="email"
              value={newClient.email}
              onChange={(event) => setNewClient((current) => ({ ...current, email: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Phone"
              value={newClient.phone}
              onChange={(event) => setNewClient((current) => ({ ...current, phone: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Website"
              value={newClient.website}
              onChange={(event) => setNewClient((current) => ({ ...current, website: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Monthly Budget (NOK)"
              type="number"
              value={newClient.monthlyBudget}
              onChange={(event) => setNewClient((current) => ({ ...current, monthlyBudget: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Keywords (comma separated)"
              value={newClient.keywords}
              onChange={(event) => setNewClient((current) => ({ ...current, keywords: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClientDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createClientMutation.mutate(newClient)}
            disabled={createClientMutation.isPending || newClient.name.trim().length === 0}
          >
            Create Client
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={campaignDialogOpen} onClose={() => setCampaignDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add SEO Campaign</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="seo-campaign-client-label">Client</InputLabel>
              <Select
                labelId="seo-campaign-client-label"
                label="Client"
                value={newCampaign.clientId}
                onChange={(event) => setNewCampaign((current) => ({ ...current, clientId: event.target.value }))}
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Campaign Name"
              value={newCampaign.name}
              onChange={(event) => setNewCampaign((current) => ({ ...current, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Budget (NOK)"
              type="number"
              value={newCampaign.budget}
              onChange={(event) => setNewCampaign((current) => ({ ...current, budget: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Start Date"
              type="date"
              value={newCampaign.startDate}
              onChange={(event) => setNewCampaign((current) => ({ ...current, startDate: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCampaignDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createCampaignMutation.mutate(newCampaign)}
            disabled={
              createCampaignMutation.isPending ||
              newCampaign.clientId.length === 0 ||
              newCampaign.name.trim().length === 0
            }
          >
            Create Campaign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
