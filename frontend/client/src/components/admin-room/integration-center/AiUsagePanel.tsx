/**
 * AiUsagePanel.tsx — per-org AI-forbruk (integrasjonsanalysen steg 9)
 *
 * Motivert av kreditt-hendelsen: synlighet i hvem/hva som bruker tokens
 * FØR kontoen går tom. Leser ai_usage_daily via /api/integrations/ai-usage.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Speed as UsageIcon,
} from '@mui/icons-material';

interface UsageRow {
  provider: string;
  operation: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  days_active: number;
}

interface UsageResponse {
  days: number;
  rows: UsageRow[];
  totals: { calls: number; inputTokens: number; outputTokens: number };
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem('creatorhub_auth_token') ?? localStorage.getItem('token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmt(n: number): string {
  return new Intl.NumberFormat('nb-NO').format(n);
}

export default function AiUsagePanel() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/integrations/ai-usage?days=30', {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!r.ok) {
        setError(`HTTP ${r.status}`);
        return;
      }
      setData((await r.json()) as UsageResponse);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <UsageIcon sx={{ color: '#818cf8' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              AI-forbruk siste 30 dager
            </Typography>
            {data && (
              <Chip
                size="small"
                label={`${fmt(data.totals.inputTokens + data.totals.outputTokens)} tokens`}
                sx={{ bgcolor: '#818cf822', color: '#818cf8', fontWeight: 700 }}
              />
            )}
          </Stack>
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>
            Oppdater
          </Button>
        </Stack>

        {loading && <Typography variant="body2" color="text.secondary">Laster…</Typography>}
        {error && <Typography variant="body2" color="error">Kunne ikke hente forbruk: {error}</Typography>}
        {data && data.rows.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary">
            Ingen bokførte AI-kall ennå — tellerne fylles av neste GEO-måling.
          </Typography>
        )}

        {data && data.rows.length > 0 && (
          <TableContainer component={Box} sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Leverandør</TableCell>
                  <TableCell>Operasjon</TableCell>
                  <TableCell align="right">Kall</TableCell>
                  <TableCell align="right">Tokens inn</TableCell>
                  <TableCell align="right">Tokens ut</TableCell>
                  <TableCell align="right">Aktive dager</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={`${r.provider}|${r.operation}`}>
                    <TableCell sx={{ fontWeight: 600 }}>{r.provider}</TableCell>
                    <TableCell>{r.operation}</TableCell>
                    <TableCell align="right">{fmt(r.calls)}</TableCell>
                    <TableCell align="right">{fmt(r.input_tokens)}</TableCell>
                    <TableCell align="right">{fmt(r.output_tokens)}</TableCell>
                    <TableCell align="right">{r.days_active}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Bokføres fra API-svarenes egne usage-felt ved hver GEO-måling.
          Kall uten usage-felt telles som kall med 0 tokens — tallene er
          nedre grense, ikke estimat.
        </Typography>
      </CardContent>
    </Card>
  );
}
