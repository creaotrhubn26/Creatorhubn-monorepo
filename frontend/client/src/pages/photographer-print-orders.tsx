// Slice 9D.5.C — fotograf-side for print-bestillinger.
// Liste over alle print-orders, sortert etter sist opprettet.

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Chip, ToggleButtonGroup, ToggleButton,
  IconButton, Stack,
} from '@mui/material';
import { LocalShipping, ArrowBack } from '@mui/icons-material';
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

export default function PhotographerPrintOrders() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('pending');

  const { data, isLoading } = useQuery<{ orders: OrderRow[] }>({
    queryKey: ['/api/photographer/print-orders'],
    queryFn: () => apiRequest('/api/photographer/print-orders'),
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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => history.back()} size="small">
          <ArrowBack />
        </IconButton>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShipping /> Print-bestillinger
        </Typography>
      </Stack>

      <ToggleButtonGroup
        size="small"
        value={filter}
        exclusive
        onChange={(_, v) => v && setFilter(v)}
        sx={{ mb: 2 }}
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
        <TableContainer component={Paper}>
          <Table size="small">
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
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Ingen bestillinger.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((o) => (
                <TableRow
                  key={o.id}
                  hover
                  onClick={() => o.galleryId && navigate(`/photographer/clients?email=${encodeURIComponent(o.clientEmail)}`)}
                  sx={{ cursor: o.galleryId ? 'pointer' : 'default' }}
                >
                  <TableCell>
                    <Typography variant="body2">{o.clientName || o.clientEmail}</Typography>
                    {o.clientName && (
                      <Typography variant="caption" color="text.secondary">{o.clientEmail}</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {o.totalAmount.toLocaleString('nb-NO')} {o.currency}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={o.paymentStatus} color={statusColor(o.paymentStatus)} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={o.fulfillmentStatus ?? '—'} color={statusColor(o.fulfillmentStatus)} />
                  </TableCell>
                  <TableCell>{formatDate(o.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
