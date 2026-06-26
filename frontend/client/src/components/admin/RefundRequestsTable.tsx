import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { getProfessionIcon } from '@/utils/profession-icons';
import { TableVirtuoso } from 'react-virtuoso';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Typography,
  Checkbox,
  Toolbar,
  Tooltip,
  Stack,
  Snackbar,
} from '@mui/material';
import type { TableHeadProps } from '@mui/material/TableHead';
import {
  CheckCircle,
  Cancel,
  Visibility,
  Email,
  SelectAll,
} from '@mui/icons-material';

interface RefundRequest {
  id: number;
  user_id: string;
  user_email: string;
  first_name: string;
  last_name: string;
  transaction_id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  processed_at?: string;
}

export default function RefundRequestsTable() {
  const queryClient = useQueryClient();
  const { analytics } = useEnhancedMasterIntegration();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'admin';
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession];
  const professionColor = enhancedProfessionConfig?.color || '#ff8c00';
  const professionDisplayName =
    enhancedProfessionConfig?.displayName || enhancedProfessionConfig?.name || currentProfession;
  const professionIcon = getProfessionIcon(currentProfession);

  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | 'bulk' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  // Fetch refund requests
  const { data: refundRequests, isLoading } = useQuery({
    queryKey: ['/api/admin/refund-requests'],
    queryFn: () => apiRequest('/api/admin/refund-requests'),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Approve refund mutation
  const approveMutation = useMutation({
    mutationFn: (refundId: number) => 
      apiRequest(`/api/admin/refund-requests/${refundId}/approve`, {
        method: 'POST'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics/refunds'] });
      setActionDialog(null);
      setSelectedRefund(null);
    }
  });

  // Reject refund mutation
  const rejectMutation = useMutation({
    mutationFn: ({ refundId, reason }: { refundId: number; reason: string }) =>
      apiRequest(`/api/admin/refund-requests/${refundId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics/refunds'] });
      setActionDialog(null);
      setSelectedRefund(null);
      setRejectionReason('');
    }
  });

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (refundIds: number[]) => {
      analytics.trackEvent('bulk_refund_approve', { count: refundIds.length });
      return Promise.all(
        refundIds.map(id =>
          apiRequest(`/api/admin/refund-requests/${id}/approve`, { method: 'POST' })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics/refunds'] });
      setActionDialog(null);
      setSelectedIds([]);
      // Send email notification to admin
      sendAdminNotification('bulk_approve', selectedIds.length);
    }
  });

  // Bulk reject mutation
  const bulkRejectMutation = useMutation({
    mutationFn: async ({ refundIds, reason }: { refundIds: number[]; reason: string }) => {
      analytics.trackEvent('bulk_refund_reject', { count: refundIds.length });
      return Promise.all(
        refundIds.map(id =>
          apiRequest(`/api/admin/refund-requests/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics/refunds'] });
      setActionDialog(null);
      setSelectedIds([]);
      setRejectionReason('');
      // Send email notification to admin
      sendAdminNotification('bulk_reject', selectedIds.length);
    }
  });

  // Send email notification to admin
  const sendAdminNotification = async (action: string, count: number) => {
    try {
      await apiRequest('/api/admin/notifications/refund-action', {
        method: 'POST',
        body: JSON.stringify({
          action,
          count,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to send admin notification: ', error);
    }
  };

  const handleApprove = () => {
    if (selectedRefund) {
      analytics.trackEvent('refund_approve', { refundId: selectedRefund.id });
      approveMutation.mutate(selectedRefund.id);
    }
  };

  const handleReject = () => {
    if (selectedRefund) {
      analytics.trackEvent('refund_reject', { refundId: selectedRefund.id });
      rejectMutation.mutate({ refundId: selectedRefund.id, reason: rejectionReason });
    }
  };

  const handleBulkApprove = () => {
    if (selectedIds.length > 0) {
      bulkApproveMutation.mutate(selectedIds);
    }
  };

  const handleBulkReject = () => {
    if (selectedIds.length > 0 && rejectionReason) {
      bulkRejectMutation.mutate({ refundIds: selectedIds, reason: rejectionReason });
    }
  };

  const handleSelectAll = () => {
    const pendingRequests = requests.filter((r: RefundRequest) => r.status === 'pending');
    if (selectedIds.length === pendingRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingRequests.map((r: RefundRequest) => r.id));
    }
  };

  const handleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const requests = Array.isArray(refundRequests?.refundRequests) ? refundRequests.refundRequests : [];

  if (requests.length === 0) {
    return (
      <Alert severity="info">
        Ingen refunderingsforespørsler for øyeblikket.
        <br />
        <Typography variant="caption">
          Refunderingsforespørsler fra brukere vil vises her.
        </Typography>
      </Alert>
    );
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'approved':
        return <Chip label="Godkjent" size="small" color="success" icon={<CheckCircle />} />;
      case 'rejected':
        return <Chip label="Avvist" size="small" color="error" icon={<Cancel />} />;
      case 'pending':
        return <Chip label="Ventende" size="small" color="warning" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  const pendingCount = requests.filter((r: RefundRequest) => r.status === 'pending').length;
  const renderedProfessionIcon = React.isValidElement(professionIcon)
    ? React.cloneElement(
        professionIcon as React.ReactElement<{ sx?: Record<string, unknown> }>,
        { sx: { color: professionColor, fontSize: 28 } },
      )
    : null;

  return (
    <>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {renderedProfessionIcon}
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Refunderingsforespørsler
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {professionDisplayName} • {professionAdapter.adaptDashboardTitle()}
            </Typography>
          </Box>
        </Box>
        <Chip
          label={`Ventende: ${pendingCount}`}
          color={pendingCount > 0 ? 'warning' : 'default'}
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <Toolbar
          sx={{
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
            mb: 2,
            borderRadius: 1
          }}
        >
          <Typography sx={{ flex: '1 1 100%' }} variant="subtitle1" component="div">
            {selectedIds.length} valgt
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Godkjenn alle valgte">
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={<CheckCircle />}
                onClick={() => {
                  setBulkAction('approve');
                  setActionDialog('bulk');
                }}
              >
                Godkjenn ({selectedIds.length})
              </Button>
            </Tooltip>
            <Tooltip title="Avvis alle valgte">
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<Cancel />}
                onClick={() => {
                  setBulkAction('reject');
                  setActionDialog('bulk');
                }}
              >
                Avvis ({selectedIds.length})
              </Button>
            </Tooltip>
            <Tooltip title="Send e-post til valgte brukere">
              <IconButton
                color="inherit"
                onClick={() => {
                  analytics.trackEvent('bulk_email_refund_users', { count: selectedIds.length });
                  setSnackbar({ open: true, message: `Sender e-post til ${selectedIds.length} brukere...` });
                }}
              >
                <Email />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      )}

      <Paper style={{ height: 600, width: '100%' }}>
        {/*
          react-virtuoso expects function components with plain table props for table sections.
          MUI's overridable component types need a tiny wrapper to satisfy that contract.
        */}
        <TableVirtuoso
          data={requests}
          components={{
            Scroller: React.forwardRef<HTMLDivElement>((props, ref) => (
              <TableContainer component={Paper} {...props} ref={ref} />
            )),
            Table: (props) => (
              <Table {...props} sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }} />
            ),
            TableHead: React.forwardRef<HTMLTableSectionElement, TableHeadProps>((props, ref) => (
              <TableHead {...props} ref={ref} />
            )),
            TableRow: ({ item: _item, ...props }) => <TableRow {...props} />,
            TableBody: React.forwardRef<HTMLTableSectionElement>((props, ref) => (
              <TableBody {...props} ref={ref} />
            ))}}
          fixedHeaderContent={() => (
            <TableRow>
              <TableCell padding="checkbox" sx={{ width: 50 }}>
                <Tooltip title="Velg alle ventende">
                  <Checkbox
                    indeterminate={selectedIds.length > 0 && selectedIds.length < pendingCount}
                    checked={pendingCount > 0 && selectedIds.length === pendingCount}
                    onChange={handleSelectAll}
                    icon={<SelectAll />}
                  />
                </Tooltip>
              </TableCell>
              <TableCell sx={{ width: 200, fontWeight: 600}}>Bruker</TableCell>
              <TableCell sx={{ width: 180, fontWeight: 600}}>Transaksjons-ID</TableCell>
              <TableCell align="right" sx={{ width: 120, fontWeight: 600}}>Beløp</TableCell>
              <TableCell sx={{ width: 250, fontWeight: 600}}>Årsak</TableCell>
              <TableCell align="center" sx={{ width: 120, fontWeight: 600}}>Status</TableCell>
              <TableCell sx={{ width: 150, fontWeight: 600}}>Dato</TableCell>
              <TableCell align="center" sx={{ width: 150, fontWeight: 600}}>Handlinger</TableCell>
            </TableRow>
          )}
          itemContent={(index, request) => (
            <>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedIds.includes(request.id)}
                  onChange={() => handleSelectOne(request.id)}
                  disabled={request.status !== 'pending'}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600}}>
                  {request.first_name} {request.last_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {request.user_email}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {request.transaction_id}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 600}}>
                  {(request.amount || 0).toLocaleString('nb-NO')} kr
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {request.reason || 'Ingen grunn oppgitt'}
                </Typography>
              </TableCell>
              <TableCell align="center">
                {getStatusChip(request.status)}
              </TableCell>
              <TableCell>
                <Typography variant="caption">
                  {new Date(request.requested_at).toLocaleDateString('nb-NO', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Typography>
              </TableCell>
              <TableCell align="center">
                {request.status === 'pending' ? (
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => {
                        setSelectedRefund(request);
                        setActionDialog('approve');
                      }}
                      title="Godkjenn"
                    >
                      <CheckCircle />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        setSelectedRefund(request);
                        setActionDialog('reject');
                      }}
                      title="Avvis"
                    >
                      <Cancel />
                    </IconButton>
                  </Box>
                ) : (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedRefund(request);
                    }}
                    title="Vis detaljer"
                  >
                    <Visibility />
                  </IconButton>
                )}
              </TableCell>
            </>
          )}
        />
      </Paper>

      {/* Approve Dialog */}
      <Dialog open={actionDialog === 'approve'} onClose={() => setActionDialog(null)}>
        <DialogTitle>Godkjenn Refundering</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Er du sikker på at du vil godkjenne denne refunderingen?
          </Alert>
          {selectedRefund && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Bruker:</strong> {selectedRefund.first_name} {selectedRefund.last_name}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Beløp:</strong> {(selectedRefund.amount || 0).toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Transaksjons-ID:</strong> {selectedRefund.transaction_id}
              </Typography>
              <Typography variant="body2">
                <strong>Årsak:</strong> {selectedRefund.reason}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(null)}>Avbryt</Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success"
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? 'Behandler...' : 'Godkjenn'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === 'reject'} onClose={() => setActionDialog(null)}>
        <DialogTitle>Avvis Refundering</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Er du sikker på at du vil avvise denne refunderingen?
          </Alert>
          {selectedRefund && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Bruker:</strong> {selectedRefund.first_name} {selectedRefund.last_name}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Beløp:</strong> {(selectedRefund.amount || 0).toLocaleString('nb-NO')} kr
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Årsak til avvisning"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Skriv inn årsaken til avvisning..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(null)}>Avbryt</Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={rejectMutation.isPending || !rejectionReason.trim()}
          >
            {rejectMutation.isPending ? 'Behandler...' : 'Avvis'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog
        open={actionDialog === 'bulk'}
        onClose={() => {
          setActionDialog(null);
          setBulkAction(null);
          setRejectionReason(', ');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {bulkAction === 'approve' ? 'Godkjenn flere refunderinger' : 'Avvis flere refunderinger'}
        </DialogTitle>
        <DialogContent>
          <Alert severity={bulkAction === 'approve' ? 'success' : 'error'} sx={{ mb: 2 }}>
            {bulkAction === 'approve'
              ? `Er du sikker på at du vil godkjenne ${selectedIds.length} refunderinger?`
              : `Er du sikker på at du vil avvise ${selectedIds.length} refunderinger?`
            }
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Dette vil sende e-postvarsler til alle berørte brukere.
          </Typography>
          {bulkAction === 'reject' && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Årsak til avvisning"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Skriv inn årsaken til avvisning..."
              required
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setActionDialog(null);
            setBulkAction(null);
            setRejectionReason('');
          }}>
            Avbryt
          </Button>
          <Button
            onClick={bulkAction === 'approve' ? handleBulkApprove : handleBulkReject}
            variant="contained"
            color={bulkAction === 'approve' ? 'success' : 'error'}
            disabled={
              (bulkAction === 'approve' && bulkApproveMutation.isPending) ||
              (bulkAction === 'reject' && (bulkRejectMutation.isPending || !rejectionReason.trim()))
            }
          >
            {bulkApproveMutation.isPending || bulkRejectMutation.isPending
              ? 'Behandler...'
              : bulkAction ==='approve'
              ? `Godkjenn ${selectedIds.length}`
              : `Avvis ${selectedIds.length}`
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ open: false, message: '' })}
          severity="info"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
