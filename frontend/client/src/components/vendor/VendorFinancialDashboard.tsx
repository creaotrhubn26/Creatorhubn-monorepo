/**
 * Vendor Financial Dashboard
 * Earnings, commissions, payouts, and tax documents
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  Avatar,
  useTheme,
  alpha
} from '@mui/material';
import {
  AttachMoney,
  TrendingUp,
  Schedule,
  CheckCircle,
  Refresh,
  Download,
  Receipt,
  AccountBalance,
  Warning,
  Info,
  ArrowForward,
  Launch
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorFinancialDashboardProps {
  vendorType: string;
  vendorName: string;
  userId: string;
}

export default function VendorFinancialDashboard({
  vendorType,
  vendorName,
  userId
}: VendorFinancialDashboardProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  
  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch financial summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/vendor-financial/summary', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-financial/summary/${vendorType}/${vendorName}/${userId}`)
  });

  // Fetch commissions
  const { data: commissionsData } = useQuery({
    queryKey: ['/api/vendor-financial/commissions', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-financial/commissions/${vendorType}/${vendorName}/${userId}`)
  });

  // Fetch payouts
  const { data: payoutsData } = useQuery({
    queryKey: ['/api/vendor-financial/payouts', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-financial/payouts/${vendorType}/${vendorName}/${userId}`)
  });

  // Fetch Stripe Connect status
  const { data: connectStatus } = useQuery({
    queryKey: ['/api/vendor-financial/connect-status', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-financial/connect-status/${vendorType}/${vendorName}/${userId}`)
  });

  // Request payout mutation
  const requestPayoutMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/vendor-financial/request-payout', {
        method: 'POST',
        body: JSON.stringify({ vendorType, vendorName, userId }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-financial'] });
    }
  });

  // Create Stripe Connect account
  const createConnectMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest('/api/vendor-financial/connect-account', {
        method: 'POST',
        body: JSON.stringify({ vendorType, vendorName, userId, email, country: 'NO' }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: (data: any) => {
      if (data.onboardingUrl) {
        window.open(data.onboardingUrl, '_blank');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-financial/connect-status'] });
      setConnectDialogOpen(false);
    }
  });

  if (summaryLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>Laster finansiell oversikt...</Typography>
      </Box>
    );
  }

  const pendingAmount = summary?.summary?.pending_amount || 0;
  const paidAmount = summary?.summary?.paid_amount || 0;
  const totalEarned = summary?.summary?.total_earned || 0;

  return (
    <Box component="main" role="main" aria-label="Finansiell Dashboard" sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: vendorConfig?.color || 'primary.main' }}>
            Finansiell Oversikt
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Inntekter, provisjoner og utbetalinger
          </Typography>
        </Box>
        
        {connectStatus?.connected && connectStatus?.payoutsEnabled ? (
          <Button
            variant="contained"
            startIcon={<AttachMoney aria-hidden="true" />}
            onClick={() => requestPayoutMutation.mutate()}
            disabled={pendingAmount < 100 || requestPayoutMutation.isPending}
            aria-label="Be om utbetaling"
            sx={{
              bgcolor: vendorConfig?.color || 'primary.main',
              minHeight: 48,
              '&:focus-visible': {
                outline: `3px solid ${vendorConfig?.color || 'primary.main'}`,
                outlineOffset: '2px'
              }
            }}
          >
            {requestPayoutMutation.isPending ? 'Behandler...' : 'Be om utbetaling'}
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<AccountBalance aria-hidden="true" />}
            onClick={() => setConnectDialogOpen(true)}
            aria-label="Koble til Stripe"
            sx={{
              bgcolor: '#635bff',
              minHeight: 48,
              '&:hover': { bgcolor: '#4b46cc' },
              '&:focus-visible': {
                outline: '3px solid #635bff',
                outlineOffset: '2px'
              }
            }}
          >
            Koble til Stripe
          </Button>
        )}
      </Box>

      {/* Stripe Connect Alert */}
      {!connectStatus?.connected && (
        <Alert severity="info" icon={<Info aria-hidden="true" />} sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Koble til Stripe for å motta utbetalinger
          </Typography>
          <Typography variant="caption">
            Du må fullføre Stripe Connect-verifiseringen før du kan motta betalinger.
          </Typography>
        </Alert>
      )}

      {/* Financial Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card sx={{ border: `2px solid ${alpha(vendorConfig?.color || '#4caf50', 0.3)}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar sx={{ bgcolor: alpha(vendorConfig?.color || '#4caf50', 0.2), color: vendorConfig?.color || '#4caf50' }} aria-hidden="true">
                    <AttachMoney aria-hidden="true" />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Til utbetaling
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: vendorConfig?.color || '#4caf50' }}>
                      {pendingAmount.toFixed(2)} NOK
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card sx={{ border: `2px solid ${alpha('#2196f3', 0.3)}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar sx={{ bgcolor: alpha('#2196f3', 0.2), color: '#2196f3' }} aria-hidden="true">
                    <CheckCircle aria-hidden="true" />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Utbetalt
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196f3' }}>
                      {paidAmount.toFixed(2)} NOK
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card sx={{ border: `2px solid ${alpha('#ff9800', 0.3)}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar sx={{ bgcolor: alpha('#ff9800', 0.2), color: '#ff9800' }} aria-hidden="true">
                    <TrendingUp aria-hidden="true" />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total opptjent
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#ff9800' }}>
                      {totalEarned.toFixed(2)} NOK
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card sx={{ border: `2px solid ${alpha('#9c27b0', 0.3)}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Avatar sx={{ bgcolor: alpha('#9c27b0', 0.2), color: '#9c27b0' }} aria-hidden="true">
                    <Receipt aria-hidden="true" />
                  </Avatar>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Transaksjoner
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#9c27b0' }}>
                      {summary?.summary?.total_commissions || 0}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} aria-label="Finansielle detaljer" sx={{ mb: 3 }}>
        <Tab label="Provisjoner" id="tab-0" aria-controls="tabpanel-0" />
        <Tab label="Utbetalinger" id="tab-1" aria-controls="tabpanel-1" />
        <Tab label="Rapporter" id="tab-2" aria-controls="tabpanel-2" />
      </Tabs>

      {/* Tab 0: Commissions */}
      {activeTab === 0 && (
        <Box role="tabpanel" id="tabpanel-0" aria-labelledby="tab-0">
          <TableContainer component={Paper}>
            <Table aria-label="Provisjoner tabell">
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col">Ordrenummer</TableCell>
                  <TableCell component="th" scope="col">Kunde</TableCell>
                  <TableCell component="th" scope="col">Beløp</TableCell>
                  <TableCell component="th" scope="col">Provisjon</TableCell>
                  <TableCell component="th" scope="col">Din andel</TableCell>
                  <TableCell component="th" scope="col">Status</TableCell>
                  <TableCell component="th" scope="col">Dato</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commissionsData?.commissions?.map((commission: any) => (
                  <TableRow key={commission.id} hover>
                    <TableCell>{commission.order_number}</TableCell>
                    <TableCell>{commission.customer_name}</TableCell>
                    <TableCell>{parseFloat(commission.order_amount).toFixed(2)} NOK</TableCell>
                    <TableCell>{parseFloat(commission.commission_rate).toFixed(1)}%</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: vendorConfig?.color }}>
                      {parseFloat(commission.vendor_payout_amount).toFixed(2)} NOK
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={commission.status === 'paid' ? 'Utbetalt' : 'Venter'}
                        size="small"
                        color={commission.status === 'paid' ? 'success' : 'warning'}
                        aria-label={`Status: ${commission.status === 'paid' ? 'Utbetalt' : 'Venter'}`}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(commission.ordered_at).toLocaleDateString('nb-NO')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Tab 1: Payouts */}
      {activeTab === 1 && (
        <Box role="tabpanel" id="tabpanel-1" aria-labelledby="tab-1">
          <TableContainer component={Paper}>
            <Table aria-label="Utbetalinger tabell">
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col">Periode</TableCell>
                  <TableCell component="th" scope="col">Beløp</TableCell>
                  <TableCell component="th" scope="col">Transaksjoner</TableCell>
                  <TableCell component="th" scope="col">Status</TableCell>
                  <TableCell component="th" scope="col">Utbetalt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payoutsData?.payouts?.map((payout: any) => (
                  <TableRow key={payout.id} hover>
                    <TableCell>
                      {new Date(payout.period_start).toLocaleDateString('nb-NO')} - {new Date(payout.period_end).toLocaleDateString('nb-NO')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: vendorConfig?.color }}>
                      {parseFloat(payout.payout_amount).toFixed(2)} NOK
                    </TableCell>
                    <TableCell>{payout.commission_count}</TableCell>
                    <TableCell>
                      <Chip
                        label={payout.status === 'paid' ? 'Utbetalt' : payout.status === 'processing' ? 'Behandles' : 'Venter'}
                        size="small"
                        color={payout.status === 'paid' ? 'success' : payout.status === 'processing' ? 'info' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      {payout.processed_at ? new Date(payout.processed_at).toLocaleDateString('nb-NO') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Tab 2: Reports */}
      {activeTab === 2 && (
        <Box role="tabpanel" id="tabpanel-2" aria-labelledby="tab-2">
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Finansielle Rapporter
              </Typography>
              <Alert severity="info">
                Månedlige og årlige rapporter genereres automatisk og vil vises her.
              </Alert>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Stripe Connect Dialog */}
      <Dialog
        open={connectDialogOpen}
        onClose={() => setConnectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="connect-dialog-title"
      >
        <DialogTitle id="connect-dialog-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AccountBalance sx={{ color: '#635bff' }} aria-hidden="true" />
            <Typography variant="h6" component="h2">
              Koble til Stripe
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            For å motta utbetalinger må du koble din bank konto gjennom Stripe Connect.
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="Sikker betalingsbehandling"
                secondary="Stripe håndterer all betalingssikkerhet og compliance"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Automatiske utbetalinger"
                secondary="Motta penger direkte til din bankkonto"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Skattedokumentasjon"
                secondary="Automatisk generering av 1099-K og MVA-dokumenter"
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setConnectDialogOpen(false)}
            sx={{
              minHeight: 48,
              '&:focus-visible': {
                outline: '3px solid',
                outlineOffset: '2px'
              }
            }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={() => createConnectMutation.mutate('vendor@example.com')}
            disabled={createConnectMutation.isPending}
            sx={{
              bgcolor: '#635bff',
              minHeight: 48,
              '&:hover': { bgcolor: '#4b46cc' },
              '&:focus-visible': {
                outline: '3px solid #635bff',
                outlineOffset: '2px'
              }
            }}
          >
            {createConnectMutation.isPending ? 'Kobler...' : 'Koble til Stripe'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


