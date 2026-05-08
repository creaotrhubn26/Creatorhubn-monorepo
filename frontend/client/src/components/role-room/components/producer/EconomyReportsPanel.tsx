/**
 * EconomyReportsPanel
 *
 * Rapport-fremvisning for produksjons-økonomi: tabeller per kategori,
 * per fase og per status. Eksporterer som CSV til klipptavlen / nedlasting
 * for videre bearbeiding i Excel/regnskapssystem.
 */

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useProducerEconomy } from '../../hooks/useProducerEconomy';

interface EconomyReportsPanelProps {
  projectId: string;
}

type ReportView = 'category' | 'phase' | 'status';

const PHASE_LABELS: Record<string, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjon',
  postproduction: 'Post-produksjon',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  pending_approval: 'Venter godkjenning',
  approved: 'Godkjent',
  blocked: 'Blokkert',
  completed: 'Fullført',
};

function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function variancePct(approved: number, actual: number): number | null {
  if (!Number.isFinite(approved) || approved === 0) return null;
  return ((actual - approved) / approved) * 100;
}

function varianceTone(v: number | null): { bg: string; fg: string } {
  if (v === null) return { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1' };
  if (v <= 0) return { bg: 'rgba(74,222,128,0.16)', fg: '#86efac' };
  if (v <= 10) return { bg: 'rgba(251,191,36,0.18)', fg: '#fde68a' };
  return { bg: 'rgba(248,113,113,0.18)', fg: '#fca5a5' };
}

function buildCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (cell: string | number) => {
    const text = String(cell);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function EconomyReportsPanel({ projectId }: EconomyReportsPanelProps) {
  const { items, loading, error } = useProducerEconomy(projectId);
  const [view, setView] = useState<ReportView>('category');

  const groupings = useMemo(() => {
    const toNum = (v: string | number) => (typeof v === 'number' ? v : Number.parseFloat(v) || 0);
    const byKey = (keyFn: (item: typeof items[number]) => string) => {
      const map = new Map<string, { key: string; estimate: number; approved: number; actual: number; lineCount: number }>();
      for (const item of items) {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, { key, estimate: 0, approved: 0, actual: 0, lineCount: 0 });
        const bucket = map.get(key)!;
        bucket.estimate += toNum(item.estimate);
        bucket.approved += toNum(item.approved);
        bucket.actual += toNum(item.actual);
        bucket.lineCount += 1;
      }
      return Array.from(map.values()).sort((a, b) => b.estimate - a.estimate);
    };
    return {
      category: byKey((item) => (item.category ?? '').trim() || 'Ukategorisert'),
      phase: byKey((item) => item.phase ?? 'unknown'),
      status: byKey((item) => item.status ?? 'unknown'),
    };
  }, [items]);

  const activeRows = groupings[view];

  const grandTotals = useMemo(
    () =>
      activeRows.reduce(
        (sum, row) => ({
          estimate: sum.estimate + row.estimate,
          approved: sum.approved + row.approved,
          actual: sum.actual + row.actual,
          lineCount: sum.lineCount + row.lineCount,
        }),
        { estimate: 0, approved: 0, actual: 0, lineCount: 0 },
      ),
    [activeRows],
  );

  const labelFor = (key: string): string => {
    if (view === 'phase') return PHASE_LABELS[key] ?? key;
    if (view === 'status') return STATUS_LABELS[key] ?? key;
    return key;
  };

  function handleExport() {
    const headers = ['Gruppering', 'Linjer', 'Estimat', 'Godkjent', 'Faktisk', 'Avvik %'];
    const rows = activeRows.map((row) => {
      const v = variancePct(row.approved, row.actual);
      return [
        labelFor(row.key),
        row.lineCount,
        Math.round(row.estimate),
        Math.round(row.approved),
        Math.round(row.actual),
        v === null ? '' : v.toFixed(1),
      ];
    });
    rows.push([
      'TOTAL',
      grandTotals.lineCount,
      Math.round(grandTotals.estimate),
      Math.round(grandTotals.approved),
      Math.round(grandTotals.actual),
      variancePct(grandTotals.approved, grandTotals.actual)?.toFixed(1) ?? '',
    ]);
    const csv = buildCsv(headers, rows);
    downloadCsv(`oekonomi-rapport-${view}-${projectId.slice(0, 16)}.csv`, csv);
  }

  function handleCopy() {
    const headers = ['Gruppering', 'Linjer', 'Estimat', 'Godkjent', 'Faktisk', 'Avvik %'];
    const rows = activeRows.map((row) => {
      const v = variancePct(row.approved, row.actual);
      return [
        labelFor(row.key),
        row.lineCount,
        Math.round(row.estimate),
        Math.round(row.approved),
        Math.round(row.actual),
        v === null ? '' : v.toFixed(1),
      ];
    });
    const tsv = [
      headers.join('\t'),
      ...rows.map((row) => row.join('\t')),
    ].join('\n');
    void navigator.clipboard?.writeText(tsv);
  }

  if (loading && items.length === 0) {
    return <Alert severity="info">Laster rapport-data…</Alert>;
  }

  if (error) {
    return <Alert severity="error">Kunne ikke laste rapport: {String(error)}</Alert>;
  }

  if (items.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          Rapporter vises når du har opprettet budsjett-linjer i Linjer-fanen.
        </Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* View-velger + eksport */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }}>
        <Stack direction="row" spacing={1}>
          {(['category', 'phase', 'status'] as ReportView[]).map((option) => (
            <Button
              key={option}
              size="small"
              variant={view === option ? 'contained' : 'outlined'}
              onClick={() => setView(option)}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: view === option ? '#1d4ed8' : 'transparent',
              }}
            >
              {option === 'category' ? 'Per kategori' : option === 'phase' ? 'Per fase' : 'Per status'}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyIcon fontSize="small" />}
            onClick={handleCopy}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Kopier til regneark
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<DownloadIcon fontSize="small" />}
            onClick={handleExport}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0f766e' }}
          >
            Last ned CSV
          </Button>
        </Stack>
      </Stack>

      {/* Tabell */}
      <Box
        sx={{
          borderRadius: 2,
          border: '1px solid rgba(148,163,184,0.16)',
          overflow: 'hidden',
        }}
      >
        <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(148,163,184,0.14)', color: '#e2e8f0' } }}>
          <TableHead>
            <TableRow sx={{ background: 'rgba(15,23,42,0.66)' }}>
              <TableCell sx={{ fontWeight: 800 }}>
                {view === 'category' ? 'Kategori' : view === 'phase' ? 'Fase' : 'Status'}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Linjer</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Estimat</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Godkjent</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Faktisk</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Avvik</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activeRows.map((row) => {
              const v = variancePct(row.approved, row.actual);
              const tone = varianceTone(v);
              return (
                <TableRow key={row.key} sx={{ '&:hover': { background: 'rgba(168,85,247,0.05)' } }}>
                  <TableCell>{labelFor(row.key)}</TableCell>
                  <TableCell align="right">{row.lineCount}</TableCell>
                  <TableCell align="right">{formatCurrency(row.estimate)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.approved)}</TableCell>
                  <TableCell align="right">{formatCurrency(row.actual)}</TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                      sx={{ bgcolor: tone.bg, color: tone.fg, fontWeight: 700 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow sx={{ background: 'rgba(15,23,42,0.66)', fontWeight: 800 }}>
              <TableCell sx={{ fontWeight: 800 }}>TOTAL</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{grandTotals.lineCount}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(grandTotals.estimate)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(grandTotals.approved)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(grandTotals.actual)}</TableCell>
              <TableCell align="right">
                {(() => {
                  const v = variancePct(grandTotals.approved, grandTotals.actual);
                  const tone = varianceTone(v);
                  return (
                    <Chip
                      size="small"
                      label={v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                      sx={{ bgcolor: tone.bg, color: tone.fg, fontWeight: 700 }}
                    />
                  );
                })()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}
