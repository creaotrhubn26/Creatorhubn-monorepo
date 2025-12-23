/**
 * User Receipts Panel
 * Shows user, 's payment receipts and auto-syncs to Fiken accounting
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Paper,
  Grid,
  Tooltip,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckIcon,
  Sync as SyncIcon,
  CloudDone as CloudDoneIcon,
  AccountBalance as BankIcon,
  Email as EmailIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';

interface Receipt {
  id: string;
  invoiceNumber: string;
  transactionId: string;
  planName: string;
  totalAmount: number;
  currency: string;
  issuedDate: string;
  paidDate: string;
  customerName: string;
  businessName: string;
  status: 'paid' | 'pending' | 'refunded';
  addons: Array<{ name: string; price: number }>;
  fikenSynced: boolean;
  fikenInvoiceId?: string;
  fikenSyncDate?: string;
  emailSent: boolean;
}

interface UserReceiptsPanelProps {
  userId: string;
}

export default function UserReceiptsPanel({ userId }: UserReceiptsPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch user's receipts
  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['/api/user/receipts', userId],
    queryFn: () => apiRequest(`/api/user/receipts?userId=${userId}`),
  });

  // Check Fiken integration status
  const { data: fikenStatus } = useQuery({
    queryKey: ['/api/integrations/fiken/status', userId],
    queryFn: () => apiRequest(`/api/integrations/fiken/status?userId=${userId}`),
  });

  // Sync to Fiken mutation
  const syncToFikenMutation = useMutation({
    mutationFn: async (receipt: Receipt) => {
      return apiRequest('/api/integrations/fiken/sync-invoice', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          receiptId: receipt.id,
          invoiceData: {
            invoiceNumber: receipt.invoiceNumber,
            transactionId: receipt.transactionId,
            customer: {
              name: receipt.customerName,
              businessName: receipt.businessName,
            },
            lines: [
              {
                description: receipt.planName,
                amount: receipt.totalAmount,
              },
              ...receipt.addons.map((addon) => ({
                description: addon.name,
                amount: addon.price,
              })),
            ],
            totalAmount: receipt.totalAmount,
            currency: receipt.currency,
            issuedDate: receipt.issuedDate,
            paidDate: receipt.paidDate,
          },
        }),
      });
    },
    onSuccess: (data, receipt) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/receipts', userId] });
      console.log('✅ Synced to Fiken: ', data);
    },
  });

  // Download receipt PDF mutation
  const downloadReceiptMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      const response = await fetch(`/api/receipts/${receiptId}/download`, {
        method: 'GET'
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  });

  // Auto-sync to Fiken when receipts are loaded
  React.useEffect(() => {
    if (fikenStatus?.connected && receipts.length > 0) {
      receipts.forEach((receipt: Receipt) => {
        if (!receipt.fikenSynced && receipt.status === 'paid') {
          console.log(`🔄 Auto-syncing receipt ${receipt.invoiceNumber} to Fiken...`);
          syncToFikenMutation.mutate(receipt);
        }
      });
    }
  }, [receipts, fikenStatus]);

  const handleViewReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowPreview(true);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (receiptsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Fiken Integration Status */}
      {fikenStatus?.connected && (
        <Alert severity="success" icon={<CloudDoneIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            ✓ Fiken Integration Active
          </Typography>
          <Typography variant="caption">
            All receipts are automatically synced to your Fiken accounting system
          </Typography>
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <ReceiptIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {receipts.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Receipts
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <MoneyIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {formatCurrency(
                receipts.reduce((sum: number, r: Receipt) => sum + r.totalAmount, 0),
                'NOK'
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Spent
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <BankIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {receipts.filter((r: Receipt) => r.fikenSynced).length}/{receipts.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Synced to Fiken
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Receipts List */}
      <Card>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <ReceiptIcon />
            Your Receipts
          </Typography>

          {receipts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ReceiptIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No receipts yet
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Your payment receipts will appear here
              </Typography>
            </Box>
          ) : (
            <List>
              {receipts.map((receipt: Receipt, index: number) => (
                <React.Fragment key={receipt.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <ListItemIcon>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          bgcolor: 'primary.light',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <ReceiptIcon sx={{ color: 'primary.main' }} />
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            Invoice #{receipt.invoiceNumber}
                          </Typography>
                          <Chip
                            label={receipt.status}
                            size="small"
                            color={receipt.status === 'paid' ? 'success' : 'default'}
                          />
                          {receipt.fikenSynced && (
                            <Tooltip
                              title={`Synced to Fiken on ${new Date(receipt.fikenSyncDate!).toLocaleDateString('no-NO')}`}
                            >
                              <Chip
                                label="Fiken"
                                size="small"
                                color="info"
                                icon={<CloudDoneIcon fontSize="small" />}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {receipt.planName}
                            {receipt.addons.length > 0 && ` + ${receipt.addons.length} add-on(s)`}
                          </Typography>
                          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              <CalendarIcon
                                sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                              {new Date(receipt.paidDate).toLocaleDateString('no-NO')}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {formatCurrency(receipt.totalAmount, receipt.currency)}
                            </Typography>
                          </Stack>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="View Receipt">
                          <IconButton size="small" onClick={() => handleViewReceipt(receipt)}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            onClick={() => downloadReceiptMutation.mutate(receipt.id)}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        {fikenStatus?.connected && !receipt.fikenSynced && (
                          <Tooltip title="Sync to Fiken">
                            <IconButton
                              size="small"
                              onClick={() => syncToFikenMutation.mutate(receipt)}
                              disabled={syncToFikenMutation.isPending}
                            >
                              {syncToFikenMutation.isPending ? (
                                <CircularProgress size={20} />
                              ) : (
                                <SyncIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Receipt Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon />
            Invoice #{selectedReceipt?.invoiceNumber}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedReceipt && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    ISSUED ON
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {new Date(selectedReceipt.issuedDate).toLocaleDateString('no-NO', {
                      month: 'long',
                      day: '2-digit',
                      year: 'numeric'
                    })}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    PAID ON
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {new Date(selectedReceipt.paidDate).toLocaleDateString('no-NO', {
                      month: 'long',
                      day: '2-digit',
                      year: 'numeric'
                    })}
                  </Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Items
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary={selectedReceipt.planName} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {formatCurrency(
                      selectedReceipt.totalAmount -
                        selectedReceipt.addons.reduce((s, a) => s + a.price, 0),
                      selectedReceipt.currency
                    )}
                  </Typography>
                </ListItem>
                {selectedReceipt.addons.map((addon, idx) => (
                  <ListItem key={idx}>
                    <ListItemText primary={`+ ${addon.name}`} />
                    <Typography variant="body2">
                      {formatCurrency(addon.price, selectedReceipt.currency)}
                    </Typography>
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Total</Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formatCurrency(selectedReceipt.totalAmount, selectedReceipt.currency)}
                </Typography>
              </Box>

              {selectedReceipt.fikenSynced && (
                <Alert severity="success" icon={<CloudDoneIcon />} sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Synced to Fiken on {new Date(selectedReceipt.fikenSyncDate!).toLocaleDateString('no-NO')}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => downloadReceiptMutation.mutate(selectedReceipt!.id)}
          >
            Download PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
