/**
 * Split Sheet Payment History
 * Component for viewing and managing payment distributions
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Grid,
  Alert
} from '@mui/material';
import {
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Payment as PaymentIcon
} from '@mui/icons-material';
import type { 
  SplitSheetPayment, 
  UpdatePaymentRequest,
  PAYMENT_STATUS_NAMES,
  PAYMENT_STATUS_COLORS
} from './types';
import { PAYMENT_STATUS_NAMES as PAYMENT_NAMES, PAYMENT_STATUS_COLORS as PAYMENT_COLORS } from './types';

interface SplitSheetPaymentHistoryProps {
  splitSheetId: string;
  currency?: string;
}

export default function SplitSheetPaymentHistory({
  splitSheetId,
  currency = 'NOK'
}: SplitSheetPaymentHistoryProps) {
  const queryClient = useQueryClient();
  const [selectedPayment, setSelectedPayment] = useState<SplitSheetPayment | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [paymentUpdate, setPaymentUpdate] = useState<UpdatePaymentRequest>({});

  // Fetch payments
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['split-sheet-payments,', splitSheetId],
    queryFn: async () => {
      const response = await apiRequest(`/api/split-sheets/${splitSheetId}/payments`);
      return response;
    }
  });

  const payments: SplitSheetPayment[] = paymentsData?.data || [];

  // Group payments by contributor
  const paymentsByContributor = payments.reduce((acc, payment) => {
    const contributorId = payment.contributor_id;
    if (!acc[contributorId]) {
      acc[contributorId] = {
        contributor: payment.contributor,
        payments: [],
        total: 0,
        paid: 0,
        pending: 0
      };
    }
    acc[contributorId].payments.push(payment);
    acc[contributorId].total += parseFloat(payment.amount.toString());
    if (payment.payment_status === 'paid') {
      acc[contributorId].paid += parseFloat(payment.amount.toString());
    } else if (payment.payment_status === 'pending') {
      acc[contributorId].pending += parseFloat(payment.amount.toString());
    }
    return acc;
  }, {} as Record<string, {
    contributor: any;
    payments: SplitSheetPayment[];
    total: number;
    paid: number;
    pending: number;
  }>);

  // Update payment mutation
  const updateMutation = useMutation({
    mutationFn: async ({ paymentId, data }: { paymentId: string; data: UpdatePaymentRequest }) => {
      const response = await apiRequest(`/api/split-sheets/payments/${paymentId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-sheet-payments', splitSheetId] });
      setShowEditDialog(false);
      setSelectedPayment(null);
      setPaymentUpdate({});
    }
  });

  const handleEditPayment = (payment: SplitSheetPayment) => {
    setSelectedPayment(payment);
    setPaymentUpdate({
      payment_status: payment.payment_status,
      payment_date: payment.payment_date || undefined,
      payment_method: payment.payment_method || undefined,
      payment_reference: payment.payment_reference || undefined,
      notes: payment.notes || undefined
    });
    setShowEditDialog(true);
  };

  const handleSavePayment = () => {
    if (selectedPayment?.id) {
      updateMutation.mutate({
        paymentId: selectedPayment.id,
        data: paymentUpdate
      });
    }
  };

  const formatCurrency = (amount: number, curr: string = currency) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: curr
    }).format(amount);
  };

  const totalPending = payments
    .filter(p => p.payment_status === 'pending')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  
  const totalPaid = payments
    .filter(p => p.payment_status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);

  return (
    <Box>
      {/* Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Totalt utestående
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 70, color: PAYMENT_COLORS.pending }}>
                {formatCurrency(totalPending)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Totalt betalt
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 70, color: PAYMENT_COLORS.paid }}>
                {formatCurrency(totalPaid)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Antall betalinger
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700}}>
                {payments.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payments by Contributor */}
      {Object.keys(paymentsByContributor).length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <PaymentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Ingen betalinger ennå
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Betalinger beregnes automatisk når inntekt legges til
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={3}>
          {Object.entries(paymentsByContributor).map(([contributorId, data]) => (
            <Card key={contributorId}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600}}>
                      {data.contributor?.name || 'Ukjent bidragsyter'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {data.payments.length} betaling(er)
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="text.secondary">
                      Totalt
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700}}>
                      {formatCurrency(data.total)}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'flex-end' }}>
                      <Chip
                        label={`Betalt: ${formatCurrency(data.paid)}`}
                        size="small"
                        sx={{ bgcolor: `${PAYMENT_COLORS.paid}20`, color: PAYMENT_COLORS.paid }}
                      />
                      <Chip
                        label={`Utestående: ${formatCurrency(data.pending)}`}
                        size="small"
                        sx={{ bgcolor: `${PAYMENT_COLORS.pending}20`, color: PAYMENT_COLORS.pending }}
                      />
                    </Stack>
                  </Box>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Dato</TableCell>
                        <TableCell>Kilde</TableCell>
                        <TableCell align="right">Beløp</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Betalingsdato</TableCell>
                        <TableCell align="right">Handlinger</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {payment.created_at 
                              ? new Date(payment.created_at).toLocaleDateString('no-NO')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {payment.revenue_id ? 'Inntekt' : 'Manuell'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600}}>
                            {formatCurrency(parseFloat(payment.amount.toString()), payment.currency)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={PAYMENT_NAMES[payment.payment_status]}
                              size="small"
                              sx={{
                                bgcolor: `${PAYMENT_COLORS[payment.payment_status]}20`,
                                color: PAYMENT_COLORS[payment.payment_status]
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {payment.payment_date
                              ? new Date(payment.payment_date).toLocaleDateString('no-NO')
                              : '-'}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleEditPayment(payment)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Edit Payment Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setSelectedPayment(null);
          setPaymentUpdate({});
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Oppdater betaling</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {selectedPayment && (
              <Alert severity="info">
                Beløp: {formatCurrency(parseFloat(selectedPayment.amount.toString()), selectedPayment.currency)}
                <br />
                Bidragsyter: {selectedPayment.contributor?.name}
                <br />
                Prosent: {selectedPayment.percentage}%
              </Alert>
            )}
            <FormControl fullWidth>
              <InputLabel>Betalingsstatus</InputLabel>
              <Select
                value={paymentUpdate.payment_status || 'pending'}
                label="Betalingsstatus"
                onChange={(e) => setPaymentUpdate({ ...paymentUpdate, payment_status: e.target.value as any })}
              >
                {Object.entries(PAYMENT_NAMES).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Betalingsdato"
              type="date"
              value={paymentUpdate.payment_date || ''}
              onChange={(e) => setPaymentUpdate({ ...paymentUpdate, payment_date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Betalingsmetode (valgfritt)"
              value={paymentUpdate.payment_method || ''}
              onChange={(e) => setPaymentUpdate({ ...paymentUpdate, payment_method: e.target.value })}
              fullWidth
              placeholder="f.eks. Bankoverføring, PayPal"
            />
            <TextField
              label="Referanse (valgfritt)"
              value={paymentUpdate.payment_reference || ''}
              onChange={(e) => setPaymentUpdate({ ...paymentUpdate, payment_reference: e.target.value })}
              fullWidth
              placeholder="Transaksjons-ID eller referanse"
            />
            <TextField
              label="Notater (valgfritt)"
              value={paymentUpdate.notes || ''}
              onChange={(e) => setPaymentUpdate({ ...paymentUpdate, notes: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEditDialog(false);
            setSelectedPayment(null);
            setPaymentUpdate({});
          }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePayment}
            disabled={updateMutation.isPending}
            sx={{ bgcolor: '#9f7aea' }}
          >
            {updateMutation.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}























