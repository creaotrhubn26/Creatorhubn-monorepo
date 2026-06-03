// PrintOrdersModal — MUI Dialog som viser fotografens print-bestillinger.
// Samme mønster som klient-modalen: maxWidth="lg", fullWidth, dark-bg,
// DialogTitle med tittel + close-X, og innholdet (Venter fulfillment /
// Alle betalte / Alle) i selve DialogContent. Erstatter den tidligere
// /photographer/print-orders-ruta i dashboard-quick-actions.

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Close, LocalShipping } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface OrderRow {
  id: string;
  galleryId: string | null;
  clientEmail: string;
  clientName: string;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string | null;
  createdAt: string;
}

function statusColor(status: string | null): 'default' | 'success' | 'warning' | 'error' {
  if (!status) return 'default';
  if (['paid', 'fulfilled', 'completed', 'shipped'].includes(status)) return 'success';
  if (['pending', 'processing'].includes(status)) return 'warning';
  if (['cancelled', 'refunded', 'failed'].includes(status)) return 'error';
  return 'default';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' });
}

export interface PrintOrdersModalProps {
  open: boolean;
  onClose: () => void;
}

export default function PrintOrdersModal({ open, onClose }: PrintOrdersModalProps) {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('pending');

  const { data, isLoading } = useQuery<{ orders: OrderRow[] }>({
    queryKey: ['/api/photographer/print-orders'],
    queryFn: () => apiRequest('/api/photographer/print-orders'),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const orders = data?.orders ?? [];
    if (filter === 'pending') {
      return orders.filter((o) => o.paymentStatus === 'paid' && o.fulfillmentStatus === 'pending');
    }
    if (filter === 'paid') {
      return orders.filter((o) => o.paymentStatus === 'paid');
    }
    return orders;
  }, [data, filter]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          minHeight: '70vh',
          bgcolor: '#0f0a07',
          color: '#fff5e8',
          border: '1px solid rgba(255, 245, 232, 0.08)',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pb: 1,
          color: '#fff5e8',
          borderBottom: '1px solid rgba(255, 245, 232, 0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShipping fontSize="small" />
          <Typography component="span" variant="h6" sx={{ fontWeight: 600 }}>
            Print-bestillinger
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Lukk"
          sx={{ color: 'inherit' }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          p: { xs: 2, md: 3 },
          bgcolor: '#0f0a07',
          borderColor: 'rgba(255, 245, 232, 0.08)',
        }}
      >
        <ToggleButtonGroup
          size="small"
          value={filter}
          exclusive
          onChange={(_, v) => v && setFilter(v)}
          sx={{
            mb: 2,
            '& .MuiToggleButton-root': {
              color: 'rgba(255, 245, 232, 0.75)',
              borderColor: 'rgba(255, 245, 232, 0.18)',
            },
            '& .MuiToggleButton-root.Mui-selected': {
              bgcolor: 'rgba(255, 245, 232, 0.12)',
              color: '#fff5e8',
            },
          }}
        >
          <ToggleButton value="pending">Venter fulfillment</ToggleButton>
          <ToggleButton value="paid">Alle betalte</ToggleButton>
          <ToggleButton value="all">Alle</ToggleButton>
        </ToggleButtonGroup>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            sx={{
              bgcolor: 'rgba(255, 245, 232, 0.04)',
              color: '#fff5e8',
              border: '1px solid rgba(255, 245, 232, 0.08)',
              boxShadow: 'none',
            }}
          >
            <Table size="small" sx={{ '& .MuiTableCell-root': { color: '#fff5e8', borderColor: 'rgba(255, 245, 232, 0.08)' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Klient</TableCell>
                  <TableCell align="right">Beløp</TableCell>
                  <TableCell>Betaling</TableCell>
                  <TableCell>Fulfillment</TableCell>
                  <TableCell>Opprettet</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'rgba(255, 245, 232, 0.55)' }}>
                      Ingen bestillinger.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((o) => (
                  <TableRow
                    key={o.id}
                    hover
                    onClick={() => {
                      if (o.galleryId) {
                        onClose();
                        navigate(`/photographer/clients?email=${encodeURIComponent(o.clientEmail)}`);
                      }
                    }}
                    sx={{
                      cursor: o.galleryId ? 'pointer' : 'default',
                      '&:hover': { bgcolor: 'rgba(255, 245, 232, 0.04)' },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2">{o.clientName || o.clientEmail}</Typography>
                      {o.clientName && (
                        <Typography variant="caption" sx={{ color: 'rgba(255, 245, 232, 0.55)' }}>
                          {o.clientEmail}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {o.totalAmount.toLocaleString('nb-NO')} {o.currency}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={o.paymentStatus} color={statusColor(o.paymentStatus)} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={o.fulfillmentStatus ?? '—'}
                        color={statusColor(o.fulfillmentStatus)}
                      />
                    </TableCell>
                    <TableCell>{formatDate(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}
