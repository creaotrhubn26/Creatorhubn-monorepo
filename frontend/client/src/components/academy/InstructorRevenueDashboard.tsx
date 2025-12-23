/**
 * Instructor Revenue Dashboard
 * Shows earnings, pending revenue, and payout management
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  AccountBalance,
  TrendingUp,
  MonetizationOn,
  Payment,
  Download,
  CheckCircle,
  Schedule,
  Warning,
  Info,
  Refresh,
  AttachMoney,
  Assessment,
  MoreVert,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { withUniversalIntegration } from '@/integration/UniversalIntegrationHOC';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  formatNOK,
  validatePayoutRequest,
  getMinimumPayoutThreshold,
  InstructorPlan,
  oreToNok,
  nokToOre,
} from '@shared/revenue-calculator';

interface RevenueStats {
  totalEarnings: number; // in øre
  pendingRevenue: number; // in øre
  paidOut: number; // in øre
  thisMonthEarnings: number; // in øre
  totalStudents: number;
  activeCourses: number;
  averageRevenuePerStudent: number; // in øre
}

interface CourseRevenue {
  courseId: string;
  courseTitle: string;
  price: number; // in øre
  enrollments: number;
  totalRevenue: number; // in øre
  instructorRevenue: number; // in øre
  platformFee: number; // in øre
}

interface PayoutHistory {
  id: string;
  amount: number; // in øre
  status: string;
  requestedAt: string;
  processedAt?: string;
  payoutMethod: string;
}

const InstructorRevenueDashboard: React.FC = () => {
  const theming = useTheming('music_producer');
  const { analytics } = useEnhancedMasterIntegration();
  const queryClient = useQueryClient();

  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutMethod, setPayoutMethod] = useState<'stripe_connect' | 'bank_transfer'>('stripe_connect',
  );

  // Fetch revenue stats
  const { data: revenueStats, isLoading: statsLoading } = useQuery<RevenueStats>({
    queryKey: ['/api/academy/revenue/stats'],
    queryFn: () => apiRequest('/api/academy/revenue/stats'),
  });

  // Fetch course revenue breakdown
  const { data: courseRevenue, isLoading: courseRevenueLoading } = useQuery<CourseRevenue[]>({
    queryKey: ['/api/academy/revenue/by-course'],
    queryFn: () => apiRequest('/api/academy/revenue/by-course'),
  });

  // Fetch payout history
  const { data: payoutHistory, isLoading: payoutHistoryLoading } = useQuery<PayoutHistory[]>({
    queryKey: ['/api/academy/revenue/payout-history'],
    queryFn: () => apiRequest('/api/academy/revenue/payout-history'),
  });

  // Fetch instructor plan
  const { data: instructorData } = useQuery<{ plan: InstructorPlan }>({
    queryKey: ['/api/auth/current-user'],
    queryFn: () => apiRequest('/api/auth/current-user'),
  });

  const instructorPlan = instructorData?.plan || 'basic';

  // Request payout mutation
  const requestPayoutMutation = useMutation({
    mutationFn: (data: { amount: number; method: string }) =>
      apiRequest('/api/academy/revenue/request-payout', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/academy/revenue/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/academy/revenue/payout-history'] });
      setPayoutDialogOpen(false);
      analytics.trackEvent('payout_requested', {
        amount: payoutAmount,
        method: payoutMethod,
        timestamp: Date.now(),
      });
    },
  });

  // Track dashboard view
  useEffect(() => {
    analytics.trackEvent('instructor_revenue_dashboard_viewed', {
      totalEarnings: revenueStats?.totalEarnings || 0,
      pendingRevenue: revenueStats?.pendingRevenue || 0,
      timestamp: Date.now(),
    });
  }, [revenueStats, analytics]);

  const handleRequestPayout = () => {
    const validation = validatePayoutRequest(
      revenueStats?.pendingRevenue || 0,
      nokToOre(payoutAmount),
      instructorPlan,
    );

    if (!validation.isValid) {
      alert(validation.reason);
      return;
    }

    requestPayoutMutation.mutate({
      amount: nokToOre(payoutAmount),
      method: payoutMethod,
    });
  };

  if (statsLoading) {
	  return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Laster inntektsdata...
        </Typography>
      </Box>
    );
  }

  const minimumPayout = getMinimumPayoutThreshold(instructorPlan);
  const canRequestPayout = (revenueStats?.pendingRevenue || 0) >= minimumPayout;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
            Inntektsoversikt
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Spor dine kursinntekter og administrer utbetalinger
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/academy/revenue/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/academy/revenue/by-course'] });
          }}
        >
          Oppdater
        </Button>
      </Box>

      {/* Revenue Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.light', border: '2px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <MonetizationOn sx={{ color: 'success.dark', mr: 1 }} />
                <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 'bold' }}>
                  TOTAL INNTEKT
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                {formatNOK(revenueStats?.totalEarnings || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'success.dark' }}>
                {revenueStats?.totalStudents || 0} studenter
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.light', border: '2px solid', borderColor: 'warning.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Schedule sx={{ color: 'warning.dark', mr: 1 }} />
                <Typography variant="caption" sx={{ color: 'warning.dark', fontWeight: 'bold' }}>
                  VENTER PÅ UTBETALING
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.dark' }}>
                {formatNOK(revenueStats?.pendingRevenue || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                {canRequestPayout ? 'Klar for utbetaling' : `Min. ${formatNOK(minimumPayout)}`}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'info.light', border: '2px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Payment sx={{ color: 'info.dark', mr: 1 }} />
                <Typography variant="caption" sx={{ color: 'info.dark', fontWeight: 'bold' }}>
                  UTBETALT
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.dark' }}>
                {formatNOK(revenueStats?.paidOut || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'info.dark' }}>
                Totalt utbetalt
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.light', border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp sx={{ color: 'primary.dark', mr: 1 }} />
                <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 'bold' }}>
                  DENNE MÅNEDEN
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
                {formatNOK(revenueStats?.thisMonthEarnings || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'primary.dark' }}>
                Inntekt så langt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payout Request Card */}
      <Card sx={{ mb: 4, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountBalance />
              Be om utbetaling
            </Typography>
            {canRequestPayout && <Chip label="Klar!" color="success" icon={<CheckCircle />} />}
          </Box>

          <Divider sx={{ mb: 2 }} />

          {canRequestPayout ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Du har <strong>{formatNOK(revenueStats?.pendingRevenue || 0)}</strong> tilgjengelig
                for utbetaling.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<Payment />}
                onClick={() => {
                  setPayoutAmount(oreToNok(revenueStats?.pendingRevenue || 0));
                  setPayoutDialogOpen(true);
                }}
                sx={{ ...theming.getThemedButtonSx() }}
              >
                Be om utbetaling
              </Button>
            </Box>
          ) : (
            <Alert severity="info">
              <Typography variant="body2">
                Minimum utbetalingsbeløp er <strong>{formatNOK(minimumPayout)}</strong>. Du har for
                øyeblikket <strong>{formatNOK(revenueStats?.pendingRevenue || 0)}</strong>{', '}
                tilgjengelig.
              </Typography>
              <LinearProgress
                variant="determinate"
                value={((revenueStats?.pendingRevenue || 0) / minimumPayout) * 100}
                sx={{ mt: 2 }}
              />
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Revenue by Course */}
      <Card sx={{ mb: 4, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Assessment />
            Inntekt per kurs
          </Typography>

          <Divider sx={{ my: 2 }} />

          {courseRevenueLoading ? (
            <LinearProgress />
          ) : courseRevenue && courseRevenue.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Kurs</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Pris</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Studenter</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Omsetning</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Din inntekt</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {courseRevenue.map((course) => (
                    <TableRow key={course.courseId} hover>
                      <TableCell>{course.courseTitle}</TableCell>
                      <TableCell align="right">{formatNOK(course.price)}</TableCell>
                      <TableCell align="right">{course.enrollments}</TableCell>
                      <TableCell align="right">{formatNOK(course.totalRevenue)}</TableCell>
                      <TableCell align="right">
                        <Typography sx={{ fontWeight: 'bold', color: 'success.dark' }}>
                          {formatNOK(course.instructorRevenue)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">
              Ingen kursinntekter ennå. Opprett og selg ditt første kurs!
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card sx={{ ...theming.getThemedCardSx() }}>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Download />
            Utbetalingshistorikk
          </Typography>

          <Divider sx={{ my: 2 }} />

          {payoutHistoryLoading ? (
            <LinearProgress />
          ) : payoutHistory && payoutHistory.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>Dato</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Beløp</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Metode</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Status</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Behandlet</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payoutHistory.map((payout) => (
                    <TableRow key={payout.id} hover>
                      <TableCell>
                        {new Date(payout.requestedAt).toLocaleDateString('no-NO')}
                      </TableCell>
                      <TableCell>{formatNOK(payout.amount)}</TableCell>
                      <TableCell>
                        {payout.payoutMethod === 'stripe_connect'
                          ? 'Stripe Connect'
                          : 'Bankoverføring'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payout.status}
                          size="small"
                          color={
                            payout.status === 'completed'
                              ? 'success'
                              : payout.status === 'processing'
                                ? 'warning'
                                : payout.status === 'rejected'
                                  ? 'error'
                                  : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        {payout.processedAt
                          ? new Date(payout.processedAt).toLocaleDateString('no-NO')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">Ingen utbetalinger ennå</Typography>
          )}
        </CardContent>
      </Card>

      {/* Payout Request Dialog */}
      <Dialog
        open={payoutDialogOpen}
        onClose={() => setPayoutDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Be om utbetaling
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Alert severity="info">
              <Typography variant="body2">
                Tilgjengelig balanse:{''}
                <strong>{formatNOK(revenueStats?.pendingRevenue || 0)}</strong>
              </Typography>
              <Typography variant="caption" display="block">
                Minimum utbetaling: {formatNOK(minimumPayout)}
              </Typography>
            </Alert>

            <TextField
              label="Utbetalingsbeløp"
              type="number"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(Number(e.target.value))}
              fullWidth
              InputProps={{
                endAdornment: <InputAdornment position="end">NOK</InputAdornment>}}
              helperText={`Maks: ${formatNOK(revenueStats?.pendingRevenue || 0)}`}
            />

            <FormControl fullWidth>
              <InputLabel>Utbetalingsmetode</InputLabel>
              <Select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as any)}
                label="Utbetalingsmetode"
              >
                <MenuItem value="stripe_connect">Stripe Connect (automatisk, 1-2 dager)</MenuItem>
                <MenuItem value="bank_transfer">Bankoverføring (manuell, 5-7 dager)</MenuItem>
              </Select>
            </FormControl>

            <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
              <Typography variant="caption" color="text.secondary">
                <strong>Viktig:</strong>
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                • Utbetalinger behandles innen 5-7 virkedager
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                • Du må ha konfigurert betalingsinformasjon i Innstillinger
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                • Eventuelle refusjoner trekkes fra neste utbetaling
              </Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayoutDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleRequestPayout}
            disabled={requestPayoutMutation.isPending}
            sx={{ ...theming.getThemedButtonSx() }}
          >
            {requestPayoutMutation.isPending ? 'Behandler...': 'Send forespørsel'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
	  );
	};

const InstructorRevenueDashboardWithIntegration = withUniversalIntegration(
	  InstructorRevenueDashboard,
		  {
		    componentId: 'instructor-revenue-dashboard',
		    componentName: 'Instructor Revenue Dashboard',
		    componentType: 'dashboard',
		    componentCategory: 'academy',
		    featureIds: [
		      'analytics-academy', 'course-analytics-revenue', 'payout-system',
		    ],
		  },
);

export { InstructorRevenueDashboardWithIntegration as InstructorRevenueDashboard };
export default InstructorRevenueDashboardWithIntegration;
