/**
 * Split Sheet Revenue Tracker
 * Component for tracking and managing revenue for split sheets
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import type { 
  SplitSheetRevenue, 
  CreateRevenueRequest,
  REVENUE_SOURCE_NAMES 
} from './types';
import { REVENUE_SOURCE_NAMES as REVENUE_NAMES } from './types';

interface SplitSheetRevenueTrackerProps {
  splitSheetId: string;
  currency?: string;
}

export default function SplitSheetRevenueTracker({
  splitSheetId,
  currency = 'NOK'
}: SplitSheetRevenueTrackerProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRevenue, setNewRevenue] = useState<CreateRevenueRequest>({
    split_sheet_id: splitSheetId,
    amount: 0,
    currency: currency,
    revenue_source: 'streaming',
    period_start: new Date().toISOString().split('T, ')[0],
    period_end: new Date().toISOString().split('T,')[0],
    platform: ', ',
    description: ', '
  });

  // Fetch revenue history
  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['split-sheet-revenue,', splitSheetId],
    queryFn: async () => {
      const response = await apiRequest(`/api/split-sheets/${splitSheetId}/revenue`);
      return response;
    }
  });

  const revenues: SplitSheetRevenue[] = revenueData?.data || [];

  // Calculate totals
  const totalRevenue = revenues.reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0);
  const revenueBySource = revenues.reduce((acc, r) => {
    acc[r.revenue_source] = (acc[r.revenue_source] || 0) + parseFloat(r.amount.toString());
    return acc;
  }, {} as Record<string, number>);

  // Create revenue mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateRevenueRequest) => {
      const response = await apiRequest(`/api/split-sheets/${splitSheetId}/revenue`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['split-sheet-revenue', splitSheetId] });
      queryClient.invalidateQueries({ queryKey: ['split-sheet-payments', splitSheetId] });
      setShowAddDialog(false);
      setNewRevenue({
        split_sheet_id: splitSheetId,
        amount: 0,
        currency: currency,
        revenue_source: 'streaming',
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date().toISOString().split('T')[0],
        platform: ', ',
        description: ', '
      });
    }
  });

  const handleAddRevenue = () => {
    if (newRevenue.amount > 0 && newRevenue.period_start && newRevenue.period_end) {
      createMutation.mutate(newRevenue);
    }
  };

  const formatCurrency = (amount: number, curr: string = currency) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: curr
    }).format(amount);
  };

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <MoneyIcon sx={{ color: '#9f7aea' }} />
                <Typography variant="body2" color="text.secondary">
                  Total inntekt
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 70, color: '#9f7aea' }}>
                {formatCurrency(totalRevenue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <TrendingUpIcon sx={{ color: '#4caf50' }} />
                <Typography variant="body2" color="text.secondary">
                  Antall registreringer
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 70, color: '#4caf50' }}>
                {revenues.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Inntekt per kilde
              </Typography>
              <Stack spacing={0.5}>
                {Object.entries(revenueBySource).map(([source, amount]) => (
                  <Box key={source} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">{REVENUE_NAMES[source as keyof typeof REVENUE_NAMES]}:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {formatCurrency(amount)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 600}}>
          Inntektshistorikk
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
          sx={{ bgcolor: '#9f7aea', '&:hover': { bgcolor: '#8e6ed6' } }}
        >
          Legg til inntekt
        </Button>
      </Box>

      {/* Revenue Table */}
      {revenues.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <MoneyIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Ingen inntekt registrert ennå
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Legg til inntekt for å begynne å spore betalinger
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
            >
              Legg til første inntekt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600}}>Periode</TableCell>
                <TableCell sx={{ fontWeight: 600}}>Kilde</TableCell>
                <TableCell sx={{ fontWeight: 600}}>Plattform</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600}}>Beløp</TableCell>
                <TableCell sx={{ fontWeight: 600}}>Beskrivelse</TableCell>
                <TableCell sx={{ fontWeight: 600}}>Dato</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {revenues.map((revenue) => (
                <TableRow key={revenue.id} hover>
                  <TableCell>
                    {new Date(revenue.period_start).toLocaleDateString('no-NO')} - {new Date(revenue.period_end).toLocaleDateString('no-NO')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={REVENUE_NAMES[revenue.revenue_source]}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{revenue.platform || '-'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600}}>
                    {formatCurrency(parseFloat(revenue.amount.toString()), revenue.currency)}
                  </TableCell>
                  <TableCell>{revenue.description || '-'}</TableCell>
                  <TableCell>
                    {revenue.created_at 
                      ? new Date(revenue.created_at).toLocaleDateString('no-NO')
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Revenue Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Legg til inntekt</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Beløp"
              type="number"
              value={newRevenue.amount}
              onChange={(e) => setNewRevenue({ ...newRevenue, amount: parseFloat(e.target.value) || 0 })}
              fullWidth
              required
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>{currency}</Typography>
              }}
            />
            <FormControl fullWidth>
              <InputLabel>Inntektskilde</InputLabel>
              <Select
                value={newRevenue.revenue_source}
                label="Inntektskilde"
                onChange={(e) => setNewRevenue({ ...newRevenue, revenue_source: e.target.value as any })}
              >
                {Object.entries(REVENUE_NAMES).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Plattform (valgfritt)"
              value={newRevenue.platform}
              onChange={(e) => setNewRevenue({ ...newRevenue, platform: e.target.value })}
              fullWidth
              placeholder="f.eks. Spotify, Apple Music"
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Periode start"
                  type="date"
                  value={newRevenue.period_start}
                  onChange={(e) => setNewRevenue({ ...newRevenue, period_start: e.target.value })}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Periode slutt"
                  type="date"
                  value={newRevenue.period_end}
                  onChange={(e) => setNewRevenue({ ...newRevenue, period_end: e.target.value })}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            <TextField
              label="Beskrivelse (valgfritt)"
              value={newRevenue.description}
              onChange={(e) => setNewRevenue({ ...newRevenue, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleAddRevenue}
            disabled={!newRevenue.amount || !newRevenue.period_start || !newRevenue.period_end || createMutation.isPending}
            sx={{ bgcolor: '#9f7aea' }}
          >
            {createMutation.isPending ? 'Legger til...' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}























