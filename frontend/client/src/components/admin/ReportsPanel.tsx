import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Grid from '@mui/material/Grid2';
import { apiRequest } from '@/lib/queryClient';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  Assessment,
  CalendarMonth,
  Download,
  Groups,
  Paid,
  Timeline,
  TrendingDown,
  TrendingUp,
  Workspaces,
} from '@mui/icons-material';
import {
  AdminCard,
  AdminButton,
  StatusChip,
  AdminTableContainer,
} from './design-system';

interface ReportsPanelProps {
  onFileDownload?: (file: {
    source: 'reports_panel';
    format: 'csv' | 'xlsx' | 'pdf';
    range: string;
  }) => void;
}

interface OverviewData {
  totalRevenue: number;
  totalProjects: number;
  totalUsers: number;
  averageProjectValue: number;
  growthRate: number;
  topProfession: string;
}

interface ProfessionStat {
  profession: string;
  users: number;
  projects: number;
  revenue: number;
  growthRate: number;
}

interface MonthlyStat {
  month: string;
  revenue: number;
  projects: number;
  users: number;
}

interface ReportsResponse {
  overview?: OverviewData;
  monthlyData?: MonthlyStat[];
}

interface BiResponse {
  professionStats?: ProfessionStat[];
}

const surfaceSx = {
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.10)',
  bgcolor: 'rgba(255,255,255,0.04)',
  boxShadow: '0 18px 44px rgba(15, 23, 42, 0.06)',
} as const;

const insetSx = {
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.10)',
  bgcolor: 'rgba(255,255,255,0.04)',
} as const;

function formatCurrency(value: number) {
  return `${value.toLocaleString('nb-NO')} kr`;
}

function formatProfession(profession: string) {
  switch (profession) {
    case 'photographer':
      return 'Fotograf';
    case 'videographer':
      return 'Videograf';
    case 'musicproducer':
      return 'Musikkprodusent';
    case 'vendor':
      return 'Leverandør';
    case 'admin':
      return 'Administrator';
    default:
      return profession || 'Ukjent';
  }
}

function getGrowthTone(value: number) {
  return value >= 0
    ? {
        icon: <TrendingUp aria-hidden="true" sx={{ fontSize: 18, color: '#86efac' }} />,
        color: '#86efac',
        bg: '#e9f7ef',
      }
    : {
        icon: <TrendingDown aria-hidden="true" sx={{ fontSize: 18, color: '#fca5a5' }} />,
        color: '#fca5a5',
        bg: '#fff1f1',
      };
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
  };
}) {
  return (
    <Paper
      sx={{
        ...surfaceSx,
        p: 2.25,
        background: tone.bg,
        borderColor: tone.border,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.9, fontSize: '1.7rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em' }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.6, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            {helper}
          </Typography>
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            display: 'grid',
            placeItems: 'center',
            bgcolor: tone.iconBg,
            color: tone.iconColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

export default function ReportsPanel({ onFileDownload }: ReportsPanelProps) {
  const [timeRange, setTimeRange] = useState('30d');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { data: reportsData, isLoading } = useQuery<ReportsResponse>({
    queryKey: ['/api/admin/reports', timeRange],
    queryFn: () => apiRequest(`/api/admin/reports?range=${timeRange}`) as Promise<ReportsResponse>,
    retry: 1,
  });

  const { data: biData } = useQuery<BiResponse>({
    queryKey: ['/api/admin/business-intelligence', timeRange],
    queryFn: () =>
      apiRequest(`/api/admin/business-intelligence?range=${timeRange}`) as Promise<BiResponse>,
    retry: 1,
  });

  const overview = reportsData?.overview || {
    totalRevenue: 0,
    totalProjects: 0,
    totalUsers: 0,
    averageProjectValue: 0,
    growthRate: 0,
    topProfession: 'professional',
  };

  const professionStats = Array.isArray(biData?.professionStats) ? biData!.professionStats! : [];
  const monthlyData = Array.isArray(reportsData?.monthlyData) ? reportsData!.monthlyData! : [];
  const totalUsers = Math.max(overview.totalUsers, 1);

  const activeProfessionCount = useMemo(
    () =>
      professionStats.filter(
        (stat) => stat.users > 0 || stat.projects > 0 || stat.revenue > 0,
      ).length,
    [professionStats],
  );

  const topProfession = useMemo(
    () =>
      professionStats.reduce<ProfessionStat | null>((top, current) => {
        if (!top || current.revenue > top.revenue) {
          return current;
        }
        return top;
      }, null),
    [professionStats],
  );

  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    onFileDownload?.({ source: 'reports_panel', format, range: timeRange });
    setAnchorEl(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }}>
        <Paper sx={{ ...surfaceSx, p: 3 }}>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
            Rapporter
          </Typography>
          <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,0.6)' }}>
            Laster innsikt, trender og kommersielle signaler.
          </Typography>
          <LinearProgress sx={{ mt: 2.5, borderRadius: '999px' }} />
        </Paper>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Paper
        sx={{
          ...surfaceSx,
          px: { xs: 2.25, sm: 3 },
          py: { xs: 2.25, sm: 2.75 },
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(255,255,255,0.04))',
        }}
      >
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          spacing={2.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', xl: 'stretch' }}
        >
          <Box sx={{ maxWidth: 760, flex: 1 }}>
            <Typography variant="overline" sx={{ color: '#ff8c00', fontWeight: 700, letterSpacing: '0.08em' }}>
              CreatorHub Insights
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: { xs: '1.9rem', sm: '2.3rem' }, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.04em' }}>
              Rapporter
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
              Les omsetning, brukervekst og profesjonsmønstre uten å hoppe mellom gamle dashboards.
              Denne flaten skal gi Daniel et tydelig beslutningsgrunnlag, ikke bare rå tabeller.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              <Chip label={`${activeProfessionCount} aktive profesjoner`} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }} />
              <Chip label={`${monthlyData.length} trendpunkter`} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }} />
              <Chip label={`Toppspor: ${formatProfession(topProfession?.profession || overview.topProfession)}`} sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }} />
            </Stack>
          </Box>

          <Box sx={{ width: { xs: '100%', xl: 320 }, display: 'grid', gap: 1.25 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Periode</InputLabel>
              <Select
                value={timeRange}
                label="Periode"
                onChange={(event) => setTimeRange(String(event.target.value))}
                sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '14px' }}
              >
                <MenuItem value="7d">7 dager</MenuItem>
                <MenuItem value="30d">30 dager</MenuItem>
                <MenuItem value="90d">3 måneder</MenuItem>
                <MenuItem value="1y">1 år</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={(event) => setAnchorEl(event.currentTarget)}
              sx={{
                borderRadius: '14px',
                bgcolor: '#111827',
                '&:hover': { bgcolor: '#0f172a' },
                boxShadow: 'none',
              }}
            >
              Eksporter rapport
            </Button>

            <Paper sx={{ ...insetSx, p: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Operativ lesing
              </Typography>
              <Typography sx={{ mt: 0.6, color: '#ffffff', fontWeight: 700 }}>
                {overview.growthRate >= 0 ? 'Veksten peker oppover' : 'Veksten må følges opp'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.4, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                {overview.growthRate >= 0
                  ? 'Du kan bruke denne flaten til å se hvilke profesjoner som faktisk driver betalt vekst.'
                  : 'Bruk profesjons- og trendtabellene til å se hvor konvertering eller ordreverdi faller.'}
              </Typography>
            </Paper>
          </Box>
        </Stack>
      </Paper>

      {professionStats.length === 0 && monthlyData.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '18px' }}>
          Rapportsignalene er tilgjengelige, men dette miljøet har foreløpig lite historikk. Flaten forblir lesbar og viser publisert grunnlag i stedet for å knekke.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<Paid />}
            label="Omsetning"
            value={formatCurrency(overview.totalRevenue)}
            helper={`${overview.growthRate >= 0 ? '+' : ''}${overview.growthRate}% mot forrige periode`}
            tone={{
              bg: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.04))',
              border: 'rgba(45, 122, 101, 0.18)',
              iconBg: '#dff7ef',
              iconColor: '#86efac',
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<Workspaces />}
            label="Prosjekter"
            value={String(overview.totalProjects)}
            helper="Totale prosjekter i valgt periode"
            tone={{
              bg: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.04))',
              border: 'rgba(37, 95, 164, 0.18)',
              iconBg: '#e9f2ff',
              iconColor: '#235fa4',
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<Groups />}
            label="Brukere"
            value={String(overview.totalUsers)}
            helper="Registrerte brukere i analysegrunnlaget"
            tone={{
              bg: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.04))',
              border: 'rgba(110, 69, 184, 0.18)',
              iconBg: '#efe7ff',
              iconColor: '#6e45b8',
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<CalendarMonth />}
            label="Gj.snittverdi"
            value={formatCurrency(overview.averageProjectValue)}
            helper="Gjennomsnittlig prosjektverdi"
            tone={{
              bg: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.04))',
              border: 'rgba(160, 90, 0, 0.18)',
              iconBg: '#fff0d8',
              iconColor: '#a05a00',
            }}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <AdminCard
            title="Profesjonsbidrag"
            subtitle="Sammenlign volum, prosjekter og omsetning uten å måtte hoppe mellom flere undersider."
            disablePadding
          >
            <AdminTableContainer ariaLabel="Profesjonsbidrag">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Profesjon</strong></TableCell>
                    <TableCell><strong>Brukere</strong></TableCell>
                    <TableCell><strong>Prosjekter</strong></TableCell>
                    <TableCell><strong>Omsetning</strong></TableCell>
                    <TableCell><strong>Vekst</strong></TableCell>
                    <TableCell><strong>Andel</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {professionStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Alert severity="info" sx={{ borderRadius: '14px' }}>
                          Ingen profesjonsdata tilgjengelig ennå.
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    professionStats.map((stat) => {
                      const growthTone = getGrowthTone(stat.growthRate);
                      const share = Math.round((stat.users / totalUsers) * 100);
                      return (
                        <TableRow key={stat.profession}>
                          <TableCell sx={{ fontWeight: 600, color: '#ffffff' }}>
                            {formatProfession(stat.profession)}
                          </TableCell>
                          <TableCell>{stat.users}</TableCell>
                          <TableCell>{stat.projects}</TableCell>
                          <TableCell>{formatCurrency(stat.revenue)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              {growthTone.icon}
                              <Typography sx={{ color: growthTone.color, fontWeight: 700 }}>
                                {stat.growthRate}%
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ minWidth: 160 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={share}
                                aria-label={`Andel av brukere: ${share}%`}
                                sx={{
                                  flex: 1,
                                  height: 8,
                                  borderRadius: '999px',
                                  bgcolor: 'rgba(255,255,255,0.06)',
                                }}
                              />
                              <Typography variant="caption" sx={{ minWidth: 30, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                                {share}%
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </AdminTableContainer>
          </AdminCard>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <AdminCard
            title="Trendlinje"
            subtitle="Bruk dette som månedlig puls på omsetning, prosjekter og nye brukere."
          >
            <Stack spacing={1.25}>
              {monthlyData.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: '14px' }}>
                  Ingen trenddata tilgjengelig ennå.
                </Alert>
              ) : (
                monthlyData.map((row, index) => (
                  <Box key={`${row.month}-${index}`} sx={{ ...insetSx, p: 1.6 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, color: '#ffffff' }}>
                          {row.month}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.35, color: 'rgba(255,255,255,0.6)' }}>
                          {row.projects} prosjekter · {row.users} nye brukere
                        </Typography>
                      </Box>
                      <StatusChip
                        label={index === 0 ? 'Nåværende' : 'Historisk'}
                        tone={index === 0 ? 'brand' : 'neutral'}
                      />
                    </Stack>
                    <Typography sx={{ mt: 1, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                      {formatCurrency(row.revenue)}
                    </Typography>
                  </Box>
                ))
              )}
            </Stack>
          </AdminCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AdminCard
            title="Fokus denne perioden"
            subtitle="Kort lesing av hvor du bør bruke oppmerksomhet."
          >
            <Stack spacing={1.5}>
              <Box sx={{ ...insetSx, p: 1.6 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Toppspor
                </Typography>
                <Typography sx={{ mt: 0.6, fontWeight: 700, color: '#ffffff' }}>
                  {topProfession ? formatProfession(topProfession.profession) : formatProfession(overview.topProfession)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: 'rgba(255,255,255,0.6)' }}>
                  {topProfession
                    ? `${formatCurrency(topProfession.revenue)} i omsetning og ${topProfession.projects} prosjekter.`
                    : 'Ingen ledende profesjon er tydelig ennå.'}
                </Typography>
              </Box>
              <Box sx={{ ...insetSx, p: 1.6 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Vekstsignal
                </Typography>
                <Typography sx={{ mt: 0.6, fontWeight: 700, color: '#ffffff' }}>
                  {overview.growthRate >= 0 ? 'Stabil positiv retning' : 'Behov for kommersiell oppfølging'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: 'rgba(255,255,255,0.6)' }}>
                  {overview.growthRate >= 0
                    ? 'Omsetningen peker opp. Neste steg er å se om prosjektveksten følger samme spor.'
                    : 'Omsetningen peker ned. Start med profesjonstabellen og se hvilke segmenter som faller.'}
                </Typography>
              </Box>
            </Stack>
          </AdminCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <AdminCard
            title="Eksport og videre arbeid"
            subtitle="Eksport brukes når teamet trenger delbar rapport utover denne arbeidsflaten."
          >
            <Stack spacing={1.25}>
              {[
                { label: 'CSV', helper: 'Rå tabell for regneark og videre filtrering.' },
                { label: 'Excel', helper: 'Delbar rapport for operativ oppfølging.' },
                { label: 'PDF', helper: 'Fast snapshot for deling med ledelse eller partner.' },
              ].map((item) => (
                <Box key={item.label} sx={{ ...insetSx, p: 1.6 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: '#ffffff' }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.35, color: 'rgba(255,255,255,0.6)' }}>
                        {item.helper}
                      </Typography>
                    </Box>
                    <AdminButton
                      size="small"
                      tone="secondary"
                      onClick={() => handleExport(item.label === 'Excel' ? 'xlsx' : item.label.toLowerCase() as 'csv' | 'pdf')}
                      sx={{ borderRadius: '999px' }}
                    >
                      Eksporter
                    </AdminButton>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </AdminCard>
        </Grid>
      </Grid>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handleExport('csv')}>Eksporter CSV</MenuItem>
        <MenuItem onClick={() => handleExport('xlsx')}>Eksporter Excel</MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>Eksporter PDF</MenuItem>
      </Menu>
    </Box>
    </ThemeProvider>
  );
}
