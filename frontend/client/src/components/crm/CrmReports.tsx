// Wave 3 (#10/#25/#40/#41/#42/#43/#29) — revenue intelligence: which channel
// brings paying customers, who's worth white-glove, what's forecast to close.
import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Stack, Typography,
  Grid, Paper, Button, Table, TableBody, TableCell, TableHead, TableRow,
  LinearProgress, CircularProgress, Alert, Chip,
} from '@mui/material';
import { Assessment as ReportIcon, Download as DownloadIcon } from '@mui/icons-material';
import { BrandScope } from './crm-brand';

const nok = (v: any) => `${Math.round(Number(v) || 0).toLocaleString('nb-NO')} kr`;
const STAGE_LABEL: Record<string, string> = {
  prospecting: 'Prospektering', qualified: 'Kvalifisert', proposal: 'Tilbud',
  negotiation: 'Forhandling', closed_won: 'Vunnet', closed_lost: 'Tapt',
};

function downloadCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface Props { open: boolean; onClose: () => void; brandColor?: string; }

export default function CrmReports({ open, onClose, brandColor }: Props) {
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['crm-reports'],
    enabled: open,
    queryFn: () => apiRequest('/api/universal-crm/reports'),
  });

  const exportCsv = async () => {
    try {
      const r = await apiRequest('/api/universal-crm/export');
      if (!r.rows?.length) { toast({ title: 'Ingenting å eksportere', variant: 'info' }); return; }
      downloadCsv(r.rows, `crm-kunder-${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: `Eksporterte ${r.rows.length} kunder`, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Eksport feilet', description: e?.message, variant: 'destructive' });
    }
  };

  const maxFunnel = Math.max(1, ...((data?.funnel || []).map((f: any) => f.count)));

  return (
    <BrandScope brandColor={brandColor}>
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <ReportIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Rapporter</Typography>
          </Stack>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Eksporter CSV</Button>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress /></Stack>
        ) : error ? (
          <Alert severity="error">Kunne ikke laste rapporter.</Alert>
        ) : data ? (
          <Stack spacing={3}>
            {/* Revenue KPIs (#10) */}
            <Grid container spacing={1.5}>
              {[
                { label: 'Åpen pipeline', value: data.revenue.pipeline, color: '#2563eb' },
                { label: 'Vunnet', value: data.revenue.won, color: '#16a34a' },
                { label: 'Realisert (betalt)', value: data.revenue.realized, color: '#7c3aed' },
                { label: 'Utestående', value: data.revenue.outstanding, color: '#f59e0b' },
              ].map((k) => (
                <Grid item xs={6} md={3} key={k.label}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: k.color }}>{nok(k.value)}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Funnel (#25) */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Pipeline-funnel</Typography>
              {(data.funnel || []).length === 0 ? <Typography variant="body2" color="text.secondary">Ingen deals ennå.</Typography> : (
                <Stack spacing={0.75}>
                  {data.funnel.map((f: any) => (
                    <Box key={f.stage}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption">{STAGE_LABEL[f.stage] || f.stage} · {f.count}</Typography>
                        <Typography variant="caption" color="text.secondary">{nok(f.value)}</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={(f.count / maxFunnel) * 100} sx={{ height: 6, borderRadius: 3 }} />
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            {/* Forecast (#42) */}
            {(data.forecast || []).length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Vektet prognose (åpne deals)</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Måned</TableCell><TableCell align="right">Vektet</TableCell><TableCell align="right">Brutto</TableCell><TableCell align="right">Deals</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.forecast.map((f: any) => (
                      <TableRow key={f.month}><TableCell>{f.month}</TableCell><TableCell align="right">{nok(f.weighted)}</TableCell><TableCell align="right">{nok(f.gross)}</TableCell><TableCell align="right">{f.deals}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {/* Source ROI (#41) */}
            {(data.sourceRoi || []).length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Kilde-ROI</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Kilde</TableCell><TableCell align="right">Kunder</TableCell><TableCell align="right">Vunne deals</TableCell><TableCell align="right">Vunnet verdi</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.sourceRoi.map((s: any) => (
                      <TableRow key={s.source}><TableCell>{s.source}</TableCell><TableCell align="right">{s.customers}</TableCell><TableCell align="right">{s.wonDeals}</TableCell><TableCell align="right">{nok(s.wonValue)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {/* Top customers by LTV (#40/#43) */}
            {(data.topCustomers || []).filter((c: any) => c.ltv > 0).length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Topp kunder etter livstidsverdi</Typography>
                <Stack spacing={0.5}>
                  {data.topCustomers.filter((c: any) => c.ltv > 0).map((c: any) => (
                    <Stack key={c.id} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">{c.name}{c.wonCount > 1 ? <Chip size="small" label={`${c.wonCount}× gjenkjøp`} sx={{ ml: 1 }} /> : null}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{nok(c.ltv)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Lukk</Button></DialogActions>
    </Dialog>
    </BrandScope>
  );
}
