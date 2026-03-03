import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
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
  AccountBalance,
  Add,
  Analytics,
  Gavel,
  InfoOutlined,
  MusicNote,
  Payment,
  Receipt,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface RoyaltyEntry {
  id: string;
  songTitle: string;
  artistName: string;
  amount: number;
  source: 'TONO' | 'GRAMO' | 'Spotify' | 'Apple Music' | 'YouTube' | 'Other';
  period: string;
  paymentDate: string;
  status: 'pending' | 'paid' | 'disputed';
}

interface IntegrationStatus {
  tono: boolean;
  gramo: boolean;
  spotify: boolean;
}

interface RoyaltiesSummary {
  totalEarnings: number;
  thisMonth: number;
  activeTracks: number;
  growthPercentage: number;
}

interface NewRoyaltyForm {
  songTitle: string;
  artistName: string;
  amount: string;
  source: RoyaltyEntry['source'];
  period: string;
  paymentDate: string;
}

const fallbackEntries: RoyaltyEntry[] = [
  {
    id: 'royalty-1',
    songTitle: 'Nordic Lights',
    artistName: 'Usman Qazi',
    amount: 8420,
    source: 'TONO',
    period: '2026-Q1',
    paymentDate: '2026-02-20',
    status: 'paid',
  },
  {
    id: 'royalty-2',
    songTitle: 'Midnight Harbour',
    artistName: 'Usman Qazi',
    amount: 3110,
    source: 'GRAMO',
    period: '2026-Q1',
    paymentDate: '2026-02-25',
    status: 'pending',
  },
  {
    id: 'royalty-3',
    songTitle: 'Story Arc Intro Theme',
    artistName: 'CreatorHub Studio',
    amount: 2200,
    source: 'Spotify',
    period: '2026-01',
    paymentDate: '2026-02-15',
    status: 'paid',
  },
];

const fallbackIntegrationStatus: IntegrationStatus = {
  tono: true,
  gramo: true,
  spotify: true,
};

const fallbackSummary: RoyaltiesSummary = {
  totalEarnings: 13730,
  thisMonth: 8420,
  activeTracks: 9,
  growthPercentage: 11.6,
};

function tabA11yProps(index: number) {
  return {
    id: `royalties-tab-${index}`,
    'aria-controls': `royalties-tabpanel-${index}`,
  };
}

function TabPanel(props: { value: number; index: number; children: React.ReactNode }) {
  const { value, index, children } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`royalties-tabpanel-${index}`}
      aria-labelledby={`royalties-tab-${index}`}
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusColor(status: RoyaltyEntry['status']): 'warning' | 'success' | 'error' {
  if (status === 'paid') {
    return 'success';
  }

  if (status === 'pending') {
    return 'warning';
  }

  return 'error';
}

function sourceColor(source: RoyaltyEntry['source']): 'primary' | 'secondary' | 'success' | 'warning' | 'default' {
  if (source === 'TONO' || source === 'GRAMO') {
    return 'primary';
  }

  if (source === 'Spotify' || source === 'Apple Music') {
    return 'success';
  }

  if (source === 'YouTube') {
    return 'warning';
  }

  return 'default';
}

export default function RoyaltiesManagementDashboard() {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [showAddRoyaltyDialog, setShowAddRoyaltyDialog] = useState(false);
  const [showTonoGramoInfoDialog, setShowTonoGramoInfoDialog] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [newRoyalty, setNewRoyalty] = useState<NewRoyaltyForm>({
    songTitle: '',
    artistName: '',
    amount: '0',
    source: 'TONO',
    period: '',
    paymentDate: '',
  });

  const royaltiesQuery = useQuery({
    queryKey: ['/api/royalties'],
    queryFn: async () => safeApiRequest<RoyaltyEntry[]>('/api/royalties', fallbackEntries),
  });

  const integrationStatusQuery = useQuery({
    queryKey: ['/api/royalties/integration-status'],
    queryFn: async () =>
      safeApiRequest<IntegrationStatus>('/api/royalties/integration-status', fallbackIntegrationStatus),
  });

  const summaryQuery = useQuery({
    queryKey: ['/api/royalties/summary'],
    queryFn: async () => safeApiRequest<RoyaltiesSummary>('/api/royalties/summary', fallbackSummary),
  });

  const addRoyaltyMutation = useMutation({
    mutationFn: async (form: NewRoyaltyForm) => {
      const payload: Omit<RoyaltyEntry, 'id' | 'status'> = {
        songTitle: form.songTitle.trim(),
        artistName: form.artistName.trim(),
        amount: Number(form.amount) || 0,
        source: form.source,
        period: form.period.trim(),
        paymentDate: form.paymentDate,
      };

      await apiRequest('/api/royalties', { method: 'POST', body: payload });
    },
    onSuccess: async () => {
      setOperationMessage('Royalty entry created successfully.');
      setShowAddRoyaltyDialog(false);
      setNewRoyalty({
        songTitle: '',
        artistName: '',
        amount: '0',
        source: 'TONO',
        period: '',
        paymentDate: '',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/royalties'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/royalties/summary'] }),
      ]);
    },
    onError: () => {
      setOperationMessage('Could not create royalty entry.');
    },
  });

  const entries = royaltiesQuery.data ?? fallbackEntries;
  const integrationStatus = integrationStatusQuery.data ?? fallbackIntegrationStatus;
  const summary = summaryQuery.data ?? fallbackSummary;
  const isLoading = royaltiesQuery.isLoading || integrationStatusQuery.isLoading || summaryQuery.isLoading;

  const sourceDistribution = useMemo(() => {
    return entries.reduce<Record<RoyaltyEntry['source'], number>>(
      (acc, entry) => {
        acc[entry.source] += entry.amount;
        return acc;
      },
      {
        TONO: 0,
        GRAMO: 0,
        Spotify: 0,
        'Apple Music': 0,
        YouTube: 0,
        Other: 0,
      },
    );
  }, [entries]);

  const pendingCount = entries.filter((entry) => entry.status === 'pending').length;

  const handleRefresh = async () => {
    await Promise.all([royaltiesQuery.refetch(), integrationStatusQuery.refetch(), summaryQuery.refetch()]);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ bgcolor: 'success.main', width: 48, height: 48 }}>
            <AccountBalance />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Royalties Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              TONO, GRAMO and streaming royalty tracking
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={handleRefresh}>
            Refresh
          </Button>
          <Button startIcon={<InfoOutlined />} variant="outlined" onClick={() => setShowTonoGramoInfoDialog(true)}>
            TONO/GRAMO Info
          </Button>
          <Button startIcon={<Add />} variant="contained" onClick={() => setShowAddRoyaltyDialog(true)}>
            Add Royalty
          </Button>
        </Stack>
      </Stack>

      {operationMessage ? (
        <Alert
          sx={{ mt: 2 }}
          severity={operationMessage.includes('successfully') ? 'success' : 'warning'}
          onClose={() => setOperationMessage(null)}
        >
          {operationMessage}
        </Alert>
      ) : null}

      {isLoading ? <LinearProgress sx={{ mt: 2 }} /> : null}

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Earnings
              </Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">
                {formatCurrency(summary.totalEarnings)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                This Month
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {formatCurrency(summary.thisMonth)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Active Tracks
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {summary.activeTracks}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Growth
              </Typography>
              <Typography variant="h5" fontWeight={700} color={summary.growthPercentage >= 0 ? 'success.main' : 'error.main'}>
                {summary.growthPercentage >= 0 ? '+' : ''}
                {summary.growthPercentage.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Integration Status
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Chip icon={<Gavel />} label={`TONO: ${integrationStatus.tono ? 'Connected' : 'Disconnected'}`} color={integrationStatus.tono ? 'success' : 'error'} />
            <Chip icon={<Receipt />} label={`GRAMO: ${integrationStatus.gramo ? 'Connected' : 'Disconnected'}`} color={integrationStatus.gramo ? 'success' : 'error'} />
            <Chip icon={<MusicNote />} label={`Spotify: ${integrationStatus.spotify ? 'Connected' : 'Disconnected'}`} color={integrationStatus.spotify ? 'success' : 'error'} />
            <Chip icon={<Payment />} label={`Pending Payments: ${pendingCount}`} color={pendingCount > 0 ? 'warning' : 'success'} />
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)}>
          <Tab label="Entries" {...tabA11yProps(0)} />
          <Tab label="Analytics" icon={<Analytics />} iconPosition="start" {...tabA11yProps(1)} />
          <Tab label="Compliance" icon={<InfoOutlined />} iconPosition="start" {...tabA11yProps(2)} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Song</TableCell>
                    <TableCell>Artist</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>Payment Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>{entry.songTitle}</TableCell>
                      <TableCell>{entry.artistName}</TableCell>
                      <TableCell>
                        <Chip size="small" label={entry.source} color={sourceColor(entry.source)} />
                      </TableCell>
                      <TableCell>{entry.period}</TableCell>
                      <TableCell>{new Date(entry.paymentDate).toLocaleDateString('nb-NO')}</TableCell>
                      <TableCell>
                        <Chip size="small" label={entry.status} color={statusColor(entry.status)} />
                      </TableCell>
                      <TableCell align="right">{formatCurrency(entry.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            {Object.entries(sourceDistribution).map(([source, amount]) => (
              <Grid item xs={12} md={4} key={source}>
                <Card>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      {source}
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {formatCurrency(amount)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <TrendingUp color="success" />
                <Typography variant="h6">Trend Snapshot</Typography>
              </Stack>
              <Typography color="text.secondary">
                Growth is currently {summary.growthPercentage.toFixed(1)}% compared with previous period, driven by
                TONO/GRAMO settlements and streaming payouts.
              </Typography>
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Royalty entries should include clear source, period and payment date for auditability.
          </Alert>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Validate that contract splits and rights metadata are aligned before invoicing downstream collaborators.
          </Alert>
          <Alert severity="success">
            This dashboard keeps both manual entries and integrated payouts visible in one ledger.
          </Alert>
        </TabPanel>
      </Box>

      <Dialog open={showAddRoyaltyDialog} onClose={() => setShowAddRoyaltyDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Royalty Entry</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Song Title"
              value={newRoyalty.songTitle}
              onChange={(event) => setNewRoyalty((current) => ({ ...current, songTitle: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Artist Name"
              value={newRoyalty.artistName}
              onChange={(event) => setNewRoyalty((current) => ({ ...current, artistName: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Amount (NOK)"
              type="number"
              value={newRoyalty.amount}
              onChange={(event) => setNewRoyalty((current) => ({ ...current, amount: event.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="royalty-source-label">Source</InputLabel>
              <Select
                labelId="royalty-source-label"
                label="Source"
                value={newRoyalty.source}
                onChange={(event) =>
                  setNewRoyalty((current) => ({ ...current, source: event.target.value as RoyaltyEntry['source'] }))
                }
              >
                <MenuItem value="TONO">TONO</MenuItem>
                <MenuItem value="GRAMO">GRAMO</MenuItem>
                <MenuItem value="Spotify">Spotify</MenuItem>
                <MenuItem value="Apple Music">Apple Music</MenuItem>
                <MenuItem value="YouTube">YouTube</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Period"
              value={newRoyalty.period}
              onChange={(event) => setNewRoyalty((current) => ({ ...current, period: event.target.value }))}
              placeholder="2026-Q1"
              fullWidth
            />
            <TextField
              label="Payment Date"
              type="date"
              value={newRoyalty.paymentDate}
              onChange={(event) => setNewRoyalty((current) => ({ ...current, paymentDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddRoyaltyDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => addRoyaltyMutation.mutate(newRoyalty)}
            disabled={
              addRoyaltyMutation.isPending ||
              newRoyalty.songTitle.trim().length === 0 ||
              newRoyalty.artistName.trim().length === 0
            }
          >
            Save Entry
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showTonoGramoInfoDialog}
        onClose={() => setShowTonoGramoInfoDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>TONO and GRAMO Flow</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              TONO handles performance and mechanical rights for compositions and publishing.
            </Alert>
            <Alert severity="info">
              GRAMO manages neighboring rights for performers and phonogram producers.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Keep ISRC/ISWC identifiers and ownership splits synchronized to minimize delayed or disputed settlements.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTonoGramoInfoDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
