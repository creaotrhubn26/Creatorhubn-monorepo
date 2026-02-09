import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Stack,
  Button,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import {
  People,
  Star,
  TrendingUp,
  Refresh,
  Download,
  Notifications,
  NotificationsActive
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useTheming } from '../../utils/theming-helper';

interface ClientInsightsDashboardProps {
  profession: string;
  userId: string;
}

interface ClientBehavior {
  clientId: string;
  name: string;
  email: string;
  totalProjects: number;
  totalSpent: number;
  averageProjectValue: number;
  preferredCommunication: 'email' | 'phone' | 'chat' | 'meeting';
  responseTime: number;
  bookingPattern: string;
  seasonalTrend: string;
  lastInteraction: string;
  engagementScore: number;
}

interface SatisfactionData {
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  overallRating: number;
  qualityRating: number;
  communicationRating: number;
  timelinessRating: number;
  valueRating: number;
  reviewText?: string;
  submittedAt: string;
  wouldRecommend: boolean;
}

interface LifetimeValue {
  clientId: string;
  name: string;
  acquisitionDate: string;
  totalRevenue: number;
  projectedRevenue: number;
  averageProjectValue: number;
  projectFrequency: number;
  retentionProbability: number;
  lifetimeValueEstimate: number;
  segment: 'high_value' | 'medium_value' | 'low_value' | 'at_risk';
}

interface ReferralData {
  clientId: string;
  clientName: string;
  referralsGiven: number;
  referralsReceived: boolean;
  referralRevenue: number;
  referralConversionRate: number;
  advocacyScore: number;
  socialShares: number;
  reviewsWritten: number;
}

const ClientInsightsDashboard: React.FC<ClientInsightsDashboardProps> = ({ profession, userId }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState('12m');
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);

  const { pushEnabled, isSupported } = usePushNotifications(userId);
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const theming = useTheming(profession);
  const professionConfig = professionConfigs?.[profession];

  const queryClient = useQueryClient();

  const { data: clientBehavior = [], isLoading: behaviorLoading } = useQuery<ClientBehavior[]>({
    queryKey: ['/api/analytics/clients/behavior', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/clients/behavior?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: satisfactionData = [], isLoading: satisfactionLoading } = useQuery<SatisfactionData[]>({
    queryKey: ['/api/analytics/clients/satisfaction', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/clients/satisfaction?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: lifetimeValues = [], isLoading: lifetimeLoading } = useQuery<LifetimeValue[]>({
    queryKey: ['/api/analytics/clients/lifetime-value', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/clients/lifetime-value?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: referralData = [], isLoading: referralLoading } = useQuery<ReferralData[]>({
    queryKey: ['/api/analytics/clients/referrals', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/clients/referrals?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const exportInsightsMutation = useMutation({
    mutationFn: async (reportType: string) =>
      apiRequest('/api/analytics/clients/export', {
        method: 'POST',
        body: {
          profession,
          userId,
          reportType,
          timeRange
        }
      }),
    onSuccess: (data) => {
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    }
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const loading = behaviorLoading || satisfactionLoading || lifetimeLoading || referralLoading;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Client Insights` : 'Client Insights'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Innsikt i kundeadferd og lojalitet
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small">
            <InputLabel id="insights-range">Periode</InputLabel>
            <Select
              labelId="insights-range"
              value={timeRange}
              label="Periode"
              onChange={(event) => setTimeRange(event.target.value)}
            >
              <MenuItem value="1m">1 mnd</MenuItem>
              <MenuItem value="3m">3 mnd</MenuItem>
              <MenuItem value="6m">6 mnd</MenuItem>
              <MenuItem value="12m">12 mnd</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/analytics/clients'] })}>
            <Refresh />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => exportInsightsMutation.mutate('client-insights')}
            disabled={exportInsightsMutation.isPending}
          >
            Eksporter
          </Button>
          {isSupported && (
            <Tooltip title="Push-varsler innstillinger">
              <IconButton onClick={() => setPushSettingsOpen(true)}>
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {professionsLoading && <Typography variant="body2">Laster profesjonsdata...</Typography>}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Laster innsikt...</Typography>
        </Box>
      )}

      <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)} sx={{ mt: 3 }}>
        <Tab label="Adferd" />
        <Tab label="Tilfredshet" />
        <Tab label="LTV" />
        <Tab label="Henvisninger" />
      </Tabs>

      {selectedTab === 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Kundeatferd
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Klient</TableCell>
                    <TableCell>Prosjekter</TableCell>
                    <TableCell>Totalverdi</TableCell>
                    <TableCell>Engasjement</TableCell>
                    <TableCell>Sist kontakt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientBehavior.map((client) => (
                    <TableRow key={client.clientId}>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2">{client.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {client.email}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{client.totalProjects}</TableCell>
                      <TableCell>{formatCurrency(client.totalSpent)}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${client.engagementScore}/100`}
                          color={client.engagementScore >= 70 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{new Date(client.lastInteraction).toLocaleDateString('nb-NO')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {selectedTab === 1 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Tilfredshet og omtaler
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Klient</TableCell>
                    <TableCell>Prosjekt</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Anbefaler</TableCell>
                    <TableCell>Dato</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {satisfactionData.map((row) => (
                    <TableRow key={`${row.clientId}-${row.projectId}`}> 
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{row.projectName}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Star fontSize="small" color={row.overallRating >= 4 ? 'warning' : 'disabled'} />
                          <Typography variant="body2">{row.overallRating.toFixed(1)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={row.wouldRecommend ? 'Ja' : 'Nei'}
                          color={row.wouldRecommend ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{new Date(row.submittedAt).toLocaleDateString('nb-NO')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {selectedTab === 2 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Livstidsverdi (LTV)
            </Typography>
            <Grid container spacing={2}>
              {lifetimeValues.map((client) => (
                <Grid item xs={12} md={6} key={client.clientId}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2">{client.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Oppstart: {new Date(client.acquisitionDate).toLocaleDateString('nb-NO')}
                      </Typography>
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <Chip
                          icon={<People fontSize="small" />}
                          label={`Prosjekter/aar: ${client.projectFrequency.toFixed(1)}`}
                          size="small"
                        />
                        <Chip
                          icon={<TrendingUp fontSize="small" />}
                          label={`LTV: ${formatCurrency(client.lifetimeValueEstimate)}`}
                          size="small"
                          color={client.segment === 'high_value' ? 'success' : 'default'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Retensjon: {formatPercentage(client.retentionProbability)}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {selectedTab === 3 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Henvisninger og advocacy
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Klient</TableCell>
                    <TableCell>Henvisninger</TableCell>
                    <TableCell>Konvertering</TableCell>
                    <TableCell>Advocacy</TableCell>
                    <TableCell>Omsetning</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {referralData.map((row) => (
                    <TableRow key={row.clientId}>
                      <TableCell>{row.clientName}</TableCell>
                      <TableCell>{row.referralsGiven}</TableCell>
                      <TableCell>{formatPercentage(row.referralConversionRate)}</TableCell>
                      <TableCell>
                        <Chip
                          label={`${row.advocacyScore}/100`}
                          color={row.advocacyScore >= 70 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatCurrency(row.referralRevenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      {exportInsightsMutation.isPending && (
        <Typography variant="body2" sx={{ mt: 2 }}>
          Genererer rapport...
        </Typography>
      )}
    </Box>
  );
};

export default ClientInsightsDashboard;
