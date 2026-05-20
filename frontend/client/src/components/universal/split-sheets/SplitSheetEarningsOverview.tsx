// @ts-nocheck
/**
 * SplitSheetEarningsOverview — Slice 9X.70
 *
 * Aggregert visualisering av honorar over tid. Per person.
 *   - Pie chart (total andel)
 *   - Stacked bar chart per måned
 *   - Tabell med total + gjennomsnitt + antall sheets
 *
 * Inn-data: liste av split sheets (uansett kilde — backend, localStorage).
 * Komponenten gjør all aggregering selv.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Card,
  Avatar,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tooltip as MuiTooltip,
  alpha,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AccountBalanceWallet as WalletIcon,
  CalendarMonth as CalendarIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from 'recharts';

// ─── Typer ────────────────────────────────────────────────────────
export interface SplitSheetEntry {
  id: string;
  projectName: string;
  projectAmount: number;
  createdAt: string; // ISO
  model?: string;
  participants: Array<{
    id: string;
    name: string;
    email?: string;
    roleId?: string;
    roleLabel?: string;
    sharePct: number;
    shareKr: number;
  }>;
}

interface Props {
  sheets: SplitSheetEntry[];
  /** Hvis satt: vis kun denne personens detaljer i topp-statistikken */
  focusPersonName?: string;
}

const PALETTE = ['#ffba6c', '#4cc9f0', '#9b87f5', '#a8dadc', '#f4a261', '#e76f51', '#80ed99', '#ffd166', '#ef476f', '#06d6a0'];

const formatKr = (n: number) =>
  `${Math.round(n).toLocaleString('nb-NO')} kr`;

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const monthNames = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];
  return `${monthNames[Number(m) - 1]} ${y.slice(2)}`;
};

const SplitSheetEarningsOverview: React.FC<Props> = ({ sheets, focusPersonName }) => {
  const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('6m');

  // ─── Filter på periode ─────────────────────────────────────────
  const filteredSheets = useMemo(() => {
    if (period === 'all') return sheets;
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return sheets.filter((s) => new Date(s.createdAt) >= cutoff);
  }, [sheets, period]);

  // ─── Aggreger per person ───────────────────────────────────────
  const perPerson = useMemo(() => {
    const map = new Map<string, { name: string; total: number; sheetCount: number; roles: Set<string> }>();
    filteredSheets.forEach((sheet) => {
      sheet.participants.forEach((p) => {
        const key = p.name || 'Uten navn';
        const cur = map.get(key) || { name: key, total: 0, sheetCount: 0, roles: new Set<string>() };
        cur.total += p.shareKr;
        cur.sheetCount += 1;
        if (p.roleLabel) cur.roles.add(p.roleLabel);
        map.set(key, cur);
      });
    });
    return Array.from(map.values())
      .map((v) => ({ ...v, roles: Array.from(v.roles) }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSheets]);

  // ─── Aggreger per måned (stacked bar) ─────────────────────────
  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, Record<string, any>>();
    filteredSheets.forEach((sheet) => {
      const mKey = monthKey(sheet.createdAt);
      const cur = monthMap.get(mKey) || { month: mKey, label: monthLabel(mKey) };
      sheet.participants.forEach((p) => {
        const personKey = p.name || 'Uten navn';
        cur[personKey] = (cur[personKey] || 0) + p.shareKr;
      });
      monthMap.set(mKey, cur);
    });
    return Array.from(monthMap.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [filteredSheets]);

  const totalAcrossPeriod = perPerson.reduce((s, p) => s + p.total, 0);
  const totalSheets = filteredSheets.length;
  const avgPerSheet = totalSheets > 0 ? totalAcrossPeriod / totalSheets : 0;
  const topEarner = perPerson[0];

  const stats = [
    {
      label: 'Total honorar',
      value: formatKr(totalAcrossPeriod),
      icon: <WalletIcon />,
      color: '#ffba6c',
    },
    {
      label: 'Split sheets',
      value: String(totalSheets),
      icon: <CalendarIcon />,
      color: '#4cc9f0',
    },
    {
      label: 'Snitt per sheet',
      value: formatKr(avgPerSheet),
      icon: <TrendingUpIcon />,
      color: '#9b87f5',
    },
    {
      label: 'Topp-tjener',
      value: topEarner ? topEarner.name : '—',
      sub: topEarner ? formatKr(topEarner.total) : undefined,
      icon: <StarIcon />,
      color: '#80ed99',
    },
  ];

  if (sheets.length === 0) {
    return (
      <Card sx={{
        p: 5,
        textAlign: 'center',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px dashed rgba(255,186,108,0.32)',
        borderRadius: 3,
        color: 'rgba(246,242,234,0.72)',
        boxShadow: 'none',
      }}>
        <WalletIcon sx={{ fontSize: 48, color: 'rgba(255,186,108,0.4)', mb: 1 }} />
        <Typography variant="body1">Ingen split sheets ennå</Typography>
        <Typography variant="caption">Opprett din første splitt for å se oversikten her</Typography>
      </Card>
    );
  }

  return (
    <Stack spacing={2.5}>
      {/* Periode-velger */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
        <Box>
          <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.18em' }}>
            Honorar-statistikk
          </Typography>
          <Typography variant="h5" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: '#fff5e8' }}>
            Hvem har tjent hva
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={period}
          exclusive
          size="small"
          onChange={(_, v) => v && setPeriod(v)}
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(246,242,234,0.62)',
              border: '1px solid rgba(255,255,255,0.12)',
              textTransform: 'none',
              px: 1.5,
              '&.Mui-selected': {
                bgcolor: 'rgba(255,186,108,0.18)',
                color: '#ffba6c',
                fontWeight: 700,
                '&:hover': { bgcolor: 'rgba(255,186,108,0.22)' },
              },
            },
          }}
        >
          <ToggleButton value="3m">3 mnd</ToggleButton>
          <ToggleButton value="6m">6 mnd</ToggleButton>
          <ToggleButton value="12m">12 mnd</ToggleButton>
          <ToggleButton value="all">Alt</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Stats-kort */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5 }}>
        {stats.map((s) => (
          <Card
            key={s.label}
            sx={{
              p: 2,
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              boxShadow: 'none',
              transition: 'all 0.2s',
              '&:hover': { borderColor: alpha(s.color, 0.4) },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(s.color, 0.18), color: s.color, width: 36, height: 36 }}>
                {s.icon}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)', display: 'block' }}>
                  {s.label}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff5e8', lineHeight: 1.2, fontFamily: '"Space Grotesk", sans-serif' }} noWrap>
                  {s.value}
                </Typography>
                {s.sub && (
                  <Typography variant="caption" sx={{ color: s.color, fontWeight: 600 }}>
                    {s.sub}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Card>
        ))}
      </Box>

      {/* Pie + Bar side om side */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, gap: 2 }}>
        {/* Pie: total andel per person */}
        <Card sx={{
          p: 2.5,
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
          boxShadow: 'none',
        }}>
          <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.14em' }}>
            Total andel
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)', display: 'block', mb: 1 }}>
            Hvem har tjent mest i perioden
          </Typography>
          <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={perPerson.map((p) => ({ name: p.name, value: p.total }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="rgba(15,10,7,0.95)"
                  strokeWidth={2}
                >
                  {perPerson.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: 'rgba(15,10,7,0.96)',
                    border: '1px solid rgba(255,186,108,0.32)',
                    borderRadius: 8,
                    color: '#fff5e8',
                  }}
                  formatter={(v: any) => formatKr(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Card>

        {/* Stacked bar: per måned */}
        <Card sx={{
          p: 2.5,
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
          boxShadow: 'none',
        }}>
          <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.14em' }}>
            Over tid
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.62)', display: 'block', mb: 1 }}>
            Honorar per måned, fordelt per person
          </Typography>
          <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'rgba(246,242,234,0.62)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                />
                <YAxis
                  tick={{ fill: 'rgba(246,242,234,0.62)', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <RTooltip
                  contentStyle={{
                    background: 'rgba(15,10,7,0.96)',
                    border: '1px solid rgba(255,186,108,0.32)',
                    borderRadius: 8,
                    color: '#fff5e8',
                  }}
                  cursor={{ fill: 'rgba(255,186,108,0.06)' }}
                  formatter={(v: any) => formatKr(Number(v))}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: 'rgba(246,242,234,0.72)' }}
                  iconType="circle"
                />
                {perPerson.map((p, idx) => (
                  <Bar
                    key={p.name}
                    dataKey={p.name}
                    stackId="earnings"
                    fill={PALETTE[idx % PALETTE.length]}
                    radius={idx === perPerson.length - 1 ? [4, 4, 0, 0] : 0}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Card>
      </Box>

      {/* Detalj-tabell */}
      <Card sx={{
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 2,
        boxShadow: 'none',
        overflow: 'hidden',
      }}>
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Typography variant="overline" sx={{ color: '#ffba6c', letterSpacing: '0.14em' }}>
            Per person
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-head': { color: 'rgba(246,242,234,0.62)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' } }}>
              <TableCell>Person</TableCell>
              <TableCell>Roller</TableCell>
              <TableCell align="right">Sheets</TableCell>
              <TableCell align="right">Snitt</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Andel</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {perPerson.map((p, idx) => {
              const color = PALETTE[idx % PALETTE.length];
              const pct = totalAcrossPeriod > 0 ? (p.total / totalAcrossPeriod) * 100 : 0;
              return (
                <TableRow
                  key={p.name}
                  sx={{
                    '& .MuiTableCell-body': { color: '#fff5e8', borderBottom: '1px solid rgba(255,255,255,0.05)' },
                    transition: 'background 0.15s',
                    '&:hover': { background: 'rgba(255,186,108,0.04)' },
                  }}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(color, 0.2), color, fontSize: 12, fontWeight: 700 }}>
                        {p.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {p.roles.slice(0, 3).map((r) => (
                        <Chip
                          key={r}
                          label={r}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            bgcolor: 'rgba(255,255,255,0.06)',
                            color: 'rgba(246,242,234,0.72)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                      ))}
                      {p.roles.length > 3 && (
                        <Chip
                          label={`+${p.roles.length - 3}`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', bgcolor: alpha(color, 0.15), color }}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{p.sheetCount}</TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                    {formatKr(p.total / Math.max(1, p.sheetCount))}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color, fontFamily: '"Space Grotesk", sans-serif' }}>
                    {formatKr(p.total)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'rgba(246,242,234,0.72)' }}>
                    {pct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
};

export default SplitSheetEarningsOverview;
