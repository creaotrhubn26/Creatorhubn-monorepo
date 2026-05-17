// @ts-nocheck
/**
 * photographer-wedding-invoice.tsx — Slice 9X.41
 *
 * Faktura-sammenstilling etter bryllupet. Henter aggregat-summary med alle
 * linjer (honorar, overtid, kjøregodtg., bom, utlegg), lar Stine justere
 * beløp/beskrivelse, og lagre/sende.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Container,
  Paper,
  Stack,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Snackbar,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface InvoiceLine {
  category: 'honorar' | 'overtid' | 'kjoregodtg' | 'bom' | 'utlegg';
  description: string;
  quantity: number;
  unit: string;
  unitPriceKr: number;
  amountKr: number;
  mvaApplicable: boolean;
}

interface InvoiceSummary {
  weddingId: string;
  coupleName: string;
  weddingDate: string;
  lines: InvoiceLine[];
  subtotalKr: number;
  mvaKr: number;
  totalKr: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  honorar: 'Honorar',
  overtid: 'Overtid',
  kjoregodtg: 'Kjøregodtg.',
  bom: 'Bom',
  utlegg: 'Utlegg',
};

const fmtKr = (n: number) => `${n.toFixed(2).replace('.', ',')} kr`;

const PhotographerWeddingInvoice: React.FC = () => {
  const params = useParams<{ weddingId: string }>();
  const weddingId = params.weddingId;
  const [, navigate] = useLocation();

  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [channel, setChannel] = useState<string>('email');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/invoice-summary`);
      setSummary(r);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke laste faktura');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [weddingId]);

  const updateLine = (idx: number, patch: Partial<InvoiceLine>) => {
    if (!summary) return;
    const lines = summary.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    recalc(lines);
  };

  const removeLine = (idx: number) => {
    if (!summary) return;
    recalc(summary.lines.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    if (!summary) return;
    recalc([...summary.lines, {
      category: 'utlegg',
      description: 'Ny linje',
      quantity: 1,
      unit: 'stk',
      unitPriceKr: 0,
      amountKr: 0,
      mvaApplicable: true,
    }]);
  };

  const recalc = (lines: InvoiceLine[]) => {
    const recomputed = lines.map((l) => ({
      ...l,
      amountKr: Math.round(l.quantity * l.unitPriceKr * 100) / 100,
    }));
    const mvaBase = recomputed.filter((l) => l.mvaApplicable).reduce((s, l) => s + l.amountKr, 0);
    const zeroBase = recomputed.filter((l) => !l.mvaApplicable).reduce((s, l) => s + l.amountKr, 0);
    const mvaKr = Math.round(mvaBase * 0.25 * 100) / 100;
    setSummary({
      ...summary!,
      lines: recomputed,
      subtotalKr: Math.round((mvaBase + zeroBase) * 100) / 100,
      mvaKr,
      totalKr: Math.round((mvaBase + zeroBase + mvaKr) * 100) / 100,
    });
  };

  const handleSaveDraft = async () => {
    if (!summary) return;
    setSaving(true);
    setError(null);
    try {
      const r: any = await apiRequest(`/api/wedding/${weddingId}/invoice`, {
        method: 'POST',
        body: { lines: summary.lines },
      });
      setSavedInvoiceId(r.invoice?.id || null);
      setSnack('Faktura lagret som utkast');
    } catch (e: any) {
      setError(e?.message || 'Lagring feilet');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSent = async () => {
    if (!savedInvoiceId) {
      setError('Lagre fakturaen først.');
      return;
    }
    setSending(true);
    try {
      await apiRequest(`/api/wedding/${weddingId}/invoice/${savedInvoiceId}/mark-sent`, {
        method: 'POST',
        body: { channel },
      });
      setSnack(`Faktura markert som sendt via ${channel}`);
    } catch (e: any) {
      setError(e?.message || 'Kunne ikke markere som sendt');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Container sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Container>;
  if (error || !summary) return <Container sx={{ py: 4 }}><Alert severity="error">{error || 'Ukjent feil'}</Alert></Container>;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(`/photographer/wedding-day/${weddingId}`)}><ArrowBack /></IconButton>
        <Typography variant="h4" sx={{ flex: 1 }}>Faktura</Typography>
        <Button startIcon={<RefreshIcon />} onClick={reload}>Re-beregn</Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle1">{summary.coupleName}</Typography>
            <Typography variant="caption" color="text.secondary">
              Bryllup {summary.weddingDate ? new Date(summary.weddingDate).toLocaleDateString('nb-NO') : '—'}
            </Typography>
          </Box>
          <Chip label={`Total: ${fmtKr(summary.totalKr)}`} color="primary" />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kategori</TableCell>
              <TableCell>Beskrivelse</TableCell>
              <TableCell align="right" sx={{ width: 80 }}>Antall</TableCell>
              <TableCell align="right" sx={{ width: 110 }}>Á-pris</TableCell>
              <TableCell align="right" sx={{ width: 60 }}>MVA</TableCell>
              <TableCell align="right" sx={{ width: 110 }}>Sum</TableCell>
              <TableCell sx={{ width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {summary.lines.map((l, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Chip size="small" label={CATEGORY_LABELS[l.category] || l.category} />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small" variant="standard" fullWidth
                    value={l.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small" variant="standard" type="number"
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                    inputProps={{ style: { textAlign: 'right', width: 60 } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField
                    size="small" variant="standard" type="number"
                    value={l.unitPriceKr}
                    onChange={(e) => updateLine(idx, { unitPriceKr: parseFloat(e.target.value) || 0 })}
                    inputProps={{ style: { textAlign: 'right', width: 80 } }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Chip
                    size="small"
                    label={l.mvaApplicable ? '25%' : '—'}
                    onClick={() => updateLine(idx, { mvaApplicable: !l.mvaApplicable })}
                    variant={l.mvaApplicable ? 'filled' : 'outlined'}
                    sx={{ minWidth: 40 }}
                  />
                </TableCell>
                <TableCell align="right">{fmtKr(l.amountKr)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => removeLine(idx)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={7}>
                <Button size="small" startIcon={<AddIcon />} onClick={addLine}>Legg til linje</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Divider />
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="flex-end" spacing={2}>
            <Box sx={{ minWidth: 200 }}>
              <Stack direction="row" justifyContent="space-between"><span>Subtotal:</span><span>{fmtKr(summary.subtotalKr)}</span></Stack>
              <Stack direction="row" justifyContent="space-between"><span>MVA (25%):</span><span>{fmtKr(summary.mvaKr)}</span></Stack>
              <Divider sx={{ my: 0.5 }} />
              <Stack direction="row" justifyContent="space-between" sx={{ fontWeight: 600 }}>
                <span>Totalt:</span><span>{fmtKr(summary.totalKr)}</span>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Paper>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={handleSaveDraft}
          disabled={saving}
        >
          {saving ? 'Lagrer…' : 'Lagre utkast'}
        </Button>
        <TextField
          select
          size="small"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          sx={{ width: 160 }}
        >
          <MenuItem value="email">E-post-PDF</MenuItem>
          <MenuItem value="poweroffice">PowerOffice GO</MenuItem>
          <MenuItem value="vipps">Vipps faktura</MenuItem>
          <MenuItem value="manual">Manuelt</MenuItem>
        </TextField>
        <Button
          variant="contained"
          startIcon={<SendIcon />}
          onClick={handleMarkSent}
          disabled={sending || !savedInvoiceId}
        >
          {sending ? 'Sender…' : 'Marker som sendt'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} message={snack} />
    </Container>
  );
};

export default PhotographerWeddingInvoice;
