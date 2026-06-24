/**
 * UserCostOverviewPanel — admin-oversikt over per-bruker kostnader
 * og margin.
 *
 * Henter fra GET /api/admin/users-storage-overview og viser:
 *   - Plan-tier + abonnement-pris
 *   - Storage-bruk (GB) + Cloudflare-kost (R2+Stream)
 *   - AI-bruk (NOK siste 30d, fra ai_usage_log)
 *   - Totalkost
 *   - CreatorHub-margin (rød hvis negativ = vi taper penger på brukeren)
 *
 * Brukes som "Bruker-kostnader"-tab i Admin Dashboard.
 *
 * Den hjelper admin å:
 *   - Identifisere "thunder dollars"-brukere som koster mer enn de betaler
 *   - Verifisere at Pro/Premium-planer faktisk gir margin
 *   - Spotte AI-misbruk (brukere med ekstrem AI-kost vs storage)
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Psychology as AiIcon,
  TrendingUp as MarginIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

type SortKey = 'totalCost' | 'storage' | 'ai' | 'margin' | 'usage';

interface UserCostRow {
  userId: string;
  planType: string;
  subscriptionStatus: string | null;
  usedBytes: number;
  usedGB: number;
  monthlyPriceNok: number;
  storageCostNok: number;
  aiCostNok30d: number;
  totalCostNok: number;
  creatorHubMarginNok: number;
  marginFraction: number;
  lastUpdated: string | null;
  stripeSubscriptionId: string | null;
  stripeStorageMeterItemId: string | null;
}

interface OverviewResponse {
  success: boolean;
  totalUsers: number;
  totals: {
    usedGB: number;
    monthlyPriceNok: number;
    storageCostNok: number;
    aiCostNok30d: number;
    totalCostNok: number;
    creatorHubMarginNok: number;
    marginFraction: number;
  };
  rows: UserCostRow[];
}

const sortToApi: Record<SortKey, string> = {
  totalCost: 'cost',
  storage: 'usage',
  ai: 'ai',
  margin: 'margin',
  usage: 'usage',
};

const formatNok = (n: number): string => {
  if (!Number.isFinite(n)) return '–';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  return `${sign}${abs.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`;
};

const formatGB = (n: number): string => {
  if (!Number.isFinite(n)) return '–';
  return `${n.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} GB`;
};

export const UserCostOverviewPanel: React.FC = () => {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('totalCost');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users-storage-overview?limit=500&sort=${sortToApi[sortKey]}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as OverviewResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.rows;
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        r.userId.toLowerCase().includes(q) ||
        r.planType.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3, minHeight: '100%' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Bruker-kostnader
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Per-bruker: lagring (Cloudflare R2+Stream), AI-bruk siste 30d, totalkost, margin til CreatorHub.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void fetchData()}
          disabled={loading}
        >
          Oppdater
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Kunne ikke hente kost-oversikt: {error}
        </Alert>
      ) : null}

      {/* Aggregate totaler */}
      {data ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <SummaryCard
            label="Inntekt"
            value={formatNok(data.totals.monthlyPriceNok)}
            icon={<MarginIcon />}
            color="#16a34a"
          />
          <SummaryCard
            label="Storage-kost"
            value={formatNok(data.totals.storageCostNok)}
            icon={<StorageIcon />}
            color="#0284c7"
          />
          <SummaryCard
            label="AI-kost (30d)"
            value={formatNok(data.totals.aiCostNok30d)}
            icon={<AiIcon />}
            color="#7c3aed"
          />
          <SummaryCard
            label="Totalkost"
            value={formatNok(data.totals.totalCostNok)}
            icon={<MarginIcon />}
            color="#dc2626"
          />
          <SummaryCard
            label="Margin til CreatorHub"
            value={formatNok(data.totals.creatorHubMarginNok)}
            sub={`${(data.totals.marginFraction * 100).toFixed(1)}%`}
            icon={data.totals.creatorHubMarginNok >= 0 ? <MarginIcon /> : <WarningIcon />}
            color={data.totals.creatorHubMarginNok >= 0 ? '#16a34a' : '#dc2626'}
          />
        </Box>
      ) : null}

      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
            <TextField
              fullWidth
              placeholder="Søk på user_id eller plan_type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
            />
          </Box>

          <TableContainer sx={{ maxHeight: 600 }}>
            {loading && !data ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell align="right">Inntekt/mnd</TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortKey === 'storage'}
                        direction="desc"
                        onClick={() => setSortKey('storage')}
                      >
                        Lagring
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Storage-kost</TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortKey === 'ai'}
                        direction="desc"
                        onClick={() => setSortKey('ai')}
                      >
                        AI-kost (30d)
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortKey === 'totalCost'}
                        direction="desc"
                        onClick={() => setSortKey('totalCost')}
                      >
                        Total kost
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel
                        active={sortKey === 'margin'}
                        direction="desc"
                        onClick={() => setSortKey('margin')}
                      >
                        Margin
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">Margin %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((row) => {
                    const isNegativeMargin = row.creatorHubMarginNok < 0;
                    return (
                      <TableRow
                        key={row.userId}
                        sx={{
                          bgcolor: isNegativeMargin
                            ? 'rgba(220, 38, 38, 0.06)'
                            : undefined,
                        }}
                      >
                        <TableCell>
                          <Tooltip title={row.userId}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row.userId}
                            </Typography>
                          </Tooltip>
                          {row.lastUpdated ? (
                            <Typography variant="caption" color="text.secondary">
                              {new Date(row.lastUpdated).toLocaleDateString('nb-NO')}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Chip
                              label={row.planType}
                              size="small"
                              sx={{ width: 'fit-content', fontWeight: 600 }}
                            />
                            {row.subscriptionStatus ? (
                              <Typography variant="caption" color="text.secondary">
                                {row.subscriptionStatus}
                              </Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatNok(row.monthlyPriceNok)}
                        </TableCell>
                        <TableCell align="right">{formatGB(row.usedGB)}</TableCell>
                        <TableCell align="right" sx={{ color: '#0284c7' }}>
                          {formatNok(row.storageCostNok)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#7c3aed' }}>
                          {formatNok(row.aiCostNok30d)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#dc2626' }}>
                          {formatNok(row.totalCostNok)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color: isNegativeMargin ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {formatNok(row.creatorHubMarginNok)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: isNegativeMargin ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {(row.marginFraction * 100).toFixed(0)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredRows.length === 0 && !loading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          Ingen brukere matcher.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </CardContent>
      </Card>

      {data ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {filteredRows.length} av {data.totalUsers} brukere vist. AI-kost beregnet siste 30
          dager (ai_usage_log). Storage-kost basert på Cloudflare R2+Stream blandet kostpris.
        </Typography>
      ) : null}
    </Box>
    </ThemeProvider>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, sub, icon, color }) => (
  <Card sx={{ borderRadius: 2, borderLeft: `4px solid ${color}` }}>
    <CardContent sx={{ py: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {label}
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color,
              fontSize: '1.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </Typography>
          {sub ? (
            <Typography variant="caption" color="text.secondary">
              {sub}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

export default UserCostOverviewPanel;
