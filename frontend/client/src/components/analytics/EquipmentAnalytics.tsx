import React, { useMemo, useState } from 'react';
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
  CircularProgress
} from '@mui/material';
import {
  Build,
  TrendingUp,
  Warning,
  Refresh,
  Download
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useTheming } from '../../utils/theming-helper';

interface EquipmentAnalyticsProps {
  profession: string;
  userId: string;
}

interface EquipmentUsage {
  id: string;
  name: string;
  type: 'camera' | 'lens' | 'audio' | 'lighting' | 'computer' | 'drone';
  totalHours: number;
  projectsUsed: number;
  utilizationRate: number;
  revenueGenerated: number;
  lastUsed: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  maintenanceScheduled: boolean;
}

interface ROIData {
  equipmentId: string;
  name: string;
  purchasePrice: number;
  currentValue: number;
  totalRevenue: number;
  roiPercentage: number;
  paybackPeriod: number;
  annualRevenue: number;
}

interface MaintenanceRecord {
  equipmentId: string;
  equipmentName: string;
  lastMaintenance: string;
  nextMaintenance: string;
  maintenanceType: 'routine' | 'repair' | 'calibration' | 'upgrade';
  cost: number;
  status: 'scheduled' | 'overdue' | 'completed';
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface ReplacementRecommendation {
  equipmentId: string;
  name: string;
  currentAge: number;
  condition: string;
  utilizationRate: number;
  maintenanceCost: number;
  recommendedAction: 'maintain' | 'upgrade' | 'replace';
  timeframe: 'immediate' | 'within_3_months' | 'within_6_months' | 'within_year';
  estimatedCost: number;
  potentialSavings: number;
}

const EquipmentAnalytics: React.FC<EquipmentAnalyticsProps> = ({ profession, userId }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState('12m');

  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const theming = useTheming(profession);
  const professionConfig = professionConfigs?.[profession];

  const queryClient = useQueryClient();

  const { data: equipmentUsage = [], isLoading: usageLoading } = useQuery<EquipmentUsage[]>({
    queryKey: ['/api/analytics/equipment/usage', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/equipment/usage?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: roiData = [], isLoading: roiLoading } = useQuery<ROIData[]>({
    queryKey: ['/api/analytics/equipment/roi', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/equipment/roi?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: maintenanceData = [], isLoading: maintenanceLoading } = useQuery<MaintenanceRecord[]>({
    queryKey: ['/api/analytics/equipment/maintenance', { profession, userId }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/equipment/maintenance?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}`
      )
  });

  const { data: recommendations = [], isLoading: recommendationsLoading } = useQuery<
    ReplacementRecommendation[]
  >({
    queryKey: ['/api/analytics/equipment/recommendations', { profession, userId }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/equipment/recommendations?profession=${encodeURIComponent(
          profession
        )}&userId=${encodeURIComponent(userId)}`
      )
  });

  const scheduleMaintenanceMutation = useMutation({
    mutationFn: async (data: { equipmentId: string; date: string; type: string; userId: string }) =>
      apiRequest('/api/equipment/schedule-maintenance', {
        method: 'POST',
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/equipment/maintenance'] });
    }
  });

  const exportAnalyticsMutation = useMutation({
    mutationFn: async (reportType: string) =>
      apiRequest('/api/analytics/equipment/export', {
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

  const usageChartData = useMemo(
    () => equipmentUsage.map((item) => ({ name: item.name, revenue: item.revenueGenerated })),
    [equipmentUsage]
  );

  const loading = usageLoading || roiLoading || maintenanceLoading || recommendationsLoading;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Equipment Analytics` : 'Equipment Analytics'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Oversikt over utstyr, ROI og vedlikehold
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small">
            <InputLabel id="equipment-range">Periode</InputLabel>
            <Select
              labelId="equipment-range"
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
          <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/analytics/equipment'] })}>
            <Refresh />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => exportAnalyticsMutation.mutate('equipment')}
            disabled={exportAnalyticsMutation.isPending}
          >
            Eksporter
          </Button>
        </Stack>
      </Stack>

      {professionsLoading && <Typography variant="body2">Laster profesjonsdata...</Typography>}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Laster utstyrsanalyse...</Typography>
        </Box>
      )}

      <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)} sx={{ mt: 3 }}>
        <Tab label="Bruk" />
        <Tab label="ROI" />
        <Tab label="Vedlikehold" />
        <Tab label="Anbefalinger" />
      </Tabs>

      {selectedTab === 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Utstyrsbruk og inntekt
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={usageChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip
                  formatter={(value) =>
                    formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0))
                  }
                />
                <Legend />
                <Bar dataKey="revenue" name="Omsetning" fill={theming.colors.primary} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {selectedTab === 1 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              ROI per utstyr
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Utstyr</TableCell>
                    <TableCell>Investering</TableCell>
                    <TableCell>Omsetning</TableCell>
                    <TableCell>ROI</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roiData.map((row) => (
                    <TableRow key={row.equipmentId}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{formatCurrency(row.purchasePrice)}</TableCell>
                      <TableCell>{formatCurrency(row.totalRevenue)}</TableCell>
                      <TableCell>{formatPercentage(row.roiPercentage)}</TableCell>
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
              Vedlikeholdsplan
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Utstyr</TableCell>
                    <TableCell>Neste vedlikehold</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Handling</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {maintenanceData.map((row) => (
                    <TableRow key={`${row.equipmentId}-${row.nextMaintenance}`}>
                      <TableCell>{row.equipmentName}</TableCell>
                      <TableCell>{new Date(row.nextMaintenance).toLocaleDateString('nb-NO')}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.status}
                          color={row.status === 'overdue' ? 'warning' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<Build />}
                          onClick={() =>
                            scheduleMaintenanceMutation.mutate({
                              equipmentId: row.equipmentId,
                              date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                              type: row.maintenanceType,
                              userId
                            })
                          }
                          disabled={scheduleMaintenanceMutation.isPending}
                        >
                          Planlegg
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {selectedTab === 3 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Anbefalte tiltak
            </Typography>
            <Grid container spacing={2}>
              {recommendations.map((row) => (
                <Grid item xs={12} md={6} key={row.equipmentId}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Warning color={row.recommendedAction === 'replace' ? 'warning' : 'action'} />
                        <Typography variant="subtitle2">{row.name}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Tilstand: {row.condition} • Utnyttelse: {formatPercentage(row.utilizationRate)}
                      </Typography>
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <Chip
                          label={`Tiltak: ${row.recommendedAction}`}
                          color={row.recommendedAction === 'replace' ? 'warning' : 'default'}
                          size="small"
                        />
                        <Chip
                          label={`Estimert kost: ${formatCurrency(row.estimatedCost)}`}
                          size="small"
                        />
                        <Chip
                          icon={<TrendingUp fontSize="small" />}
                          label={`Potensiell gevinst: ${formatCurrency(row.potentialSavings)}`}
                          size="small"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {exportAnalyticsMutation.isPending && (
        <Typography variant="body2" sx={{ mt: 2 }}>
          Genererer rapport...
        </Typography>
      )}
    </Box>
  );
};

export default EquipmentAnalytics;
