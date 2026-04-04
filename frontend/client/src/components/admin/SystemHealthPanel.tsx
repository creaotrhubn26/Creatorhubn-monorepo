import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import Grid from '@mui/material/Grid2';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';
import {
  Backup,
  CheckCircle,
  CloudQueue,
  Memory,
  Monitor,
  Replay,
  Security,
  Speed as SpeedIcon,
  Storage,
  WarningAmber,
} from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface SystemHealthPanelProps {
  onOpenBackup?: () => void;
  onOpenGdpr?: () => void;
}

interface HealthMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  databaseConnections: number;
}

interface HealthService {
  name: string;
  status: 'healthy' | 'warning' | 'error' | string;
  uptime: number;
  lastCheck?: string;
}

interface HealthResponse {
  metrics?: Partial<HealthMetrics>;
  services?: HealthService[];
  overallStatus?: 'healthy' | 'warning' | 'error';
}

interface PerformanceEvent {
  type: 'error' | 'warning' | 'success' | 'info' | string;
  message: string;
  time: string;
}

interface PerformanceResponse {
  events?: PerformanceEvent[];
}

const EMPTY_METRICS: HealthMetrics = {
  uptime: 0,
  responseTime: 0,
  errorRate: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  diskUsage: 0,
  databaseConnections: 0,
};

const surfaceSx = {
  borderRadius: '24px',
  border: '1px solid rgba(17, 24, 39, 0.08)',
  bgcolor: '#ffffff',
  boxShadow: '0 18px 44px rgba(15, 23, 42, 0.06)',
} as const;

const insetSx = {
  borderRadius: '18px',
  border: '1px solid rgba(17, 24, 39, 0.08)',
  bgcolor: '#fcfaf7',
} as const;

function getStatusColor(status: string): ChipProps['color'] {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'healthy':
      return 'Operativ';
    case 'warning':
      return 'Advarsel';
    case 'error':
      return 'Feil';
    default:
      return 'Ukjent';
  }
}

function getOverallStatusCopy(status: string) {
  switch (status) {
    case 'warning':
      return 'Noen signaler trenger oppfølging, men plattformen er fortsatt oppe.';
    case 'error':
      return 'Minst ett kritisk signal peker rødt og bør prioriteres.';
    default:
      return 'Systemet ser stabilt ut, og denne flaten kan brukes til rask driftssjekk.';
  }
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
          <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.9, fontSize: '1.65rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.03em' }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.6, color: '#6b7280', lineHeight: 1.5 }}>
            {helper}
          </Typography>
        </Box>
        <Box
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

export default function SystemHealthPanel({
  onOpenBackup,
  onOpenGdpr,
}: SystemHealthPanelProps) {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { auth } = useEnhancedMasterIntegration();

  const { data: healthData, isLoading, refetch } = useQuery<HealthResponse>({
    queryKey: ['/api/admin/system-health'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/system-health', { headers });
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: performanceData } = useQuery<PerformanceResponse>({
    queryKey: ['/api/admin/performance-metrics'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/performance-metrics', { headers });
    },
    refetchInterval: 60000,
    retry: 1,
  });

  const handleRefresh = () => {
    void refetch();
    setLastRefresh(new Date());
  };

  const systemMetrics: HealthMetrics = { ...EMPTY_METRICS, ...(healthData?.metrics ?? {}) };
  const services = healthData?.services ?? [];
  const recentEvents = performanceData?.events ?? [];
  const overallStatus = healthData?.overallStatus ?? 'healthy';

  const healthyServiceCount = services.filter((service) => service.status === 'healthy').length;
  const warningServiceCount = services.filter((service) => service.status === 'warning').length;
  const criticalServiceCount = services.filter((service) => service.status === 'error').length;

  const alertSeverity =
    overallStatus === 'error' ? 'error' : overallStatus === 'warning' ? 'warning' : 'success';

  if (isLoading) {
    return (
      <Paper sx={{ ...surfaceSx, p: 3 }}>
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#181512' }}>
          Drift
        </Typography>
        <Typography sx={{ mt: 0.75, color: '#6b7280' }}>
          Laster systemstatus, hendelser og driftskontroll.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Paper
        sx={{
          ...surfaceSx,
          px: { xs: 2.25, sm: 3 },
          py: { xs: 2.25, sm: 2.75 },
          background:
            'linear-gradient(135deg, rgba(17, 24, 39, 0.05), rgba(255, 255, 255, 0.96) 46%, rgba(8, 145, 178, 0.06))',
        }}
      >
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          spacing={2.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', xl: 'stretch' }}
        >
          <Box sx={{ maxWidth: 760, flex: 1 }}>
            <Typography variant="overline" sx={{ color: '#111827', fontWeight: 700, letterSpacing: '0.08em' }}>
              CreatorHub Operations
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: { xs: '1.9rem', sm: '2.3rem' }, fontWeight: 700, color: '#111827', letterSpacing: '-0.04em' }}>
              Drift
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: '#5b6472', lineHeight: 1.7 }}>
              Bruk denne flaten til å lese systemhelsen raskt. Backup og GDPR lever i egne faner,
              men denne siden skal gi Daniel et operativt statusbilde uten overflødig støy.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              <Chip label={`${healthyServiceCount} operative tjenester`} sx={{ bgcolor: '#ffffff', border: '1px solid rgba(17, 24, 39, 0.08)' }} />
              <Chip label={`${warningServiceCount} advarsler`} sx={{ bgcolor: '#ffffff', border: '1px solid rgba(17, 24, 39, 0.08)' }} />
              <Chip label={`${criticalServiceCount} kritiske`} sx={{ bgcolor: '#ffffff', border: '1px solid rgba(17, 24, 39, 0.08)' }} />
            </Stack>
          </Box>

          <Box sx={{ width: { xs: '100%', xl: 340 }, display: 'grid', gap: 1.25 }}>
            <Paper sx={{ ...insetSx, p: 1.6 }}>
              <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Status akkurat nå
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.8 }}>
                <Chip
                  size="small"
                  color={getStatusColor(overallStatus)}
                  label={getStatusLabel(overallStatus)}
                />
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  Sist oppdatert {lastRefresh.toLocaleTimeString('no-NO')}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 1, color: '#6b7280', lineHeight: 1.6 }}>
                {getOverallStatusCopy(overallStatus)}
              </Typography>
            </Paper>

            <Button
              variant="contained"
              startIcon={<Replay />}
              onClick={handleRefresh}
              sx={{
                borderRadius: '14px',
                bgcolor: '#111827',
                '&:hover': { bgcolor: '#0f172a' },
                boxShadow: 'none',
              }}
            >
              Oppdater status
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Alert severity={alertSeverity} sx={{ borderRadius: '18px' }}>
        <strong>{getStatusLabel(overallStatus)}.</strong> {getOverallStatusCopy(overallStatus)}
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<CheckCircle />}
            label="Oppetid"
            value={`${systemMetrics.uptime}%`}
            helper="Tilgjengelighet over siste måleperiode"
            tone={{
              bg: 'linear-gradient(180deg, rgba(236,255,252,0.98), rgba(255,255,255,0.98))',
              border: 'rgba(45, 122, 101, 0.18)',
              iconBg: '#dff7ef',
              iconColor: '#1b7b4a',
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<SpeedIcon />}
            label="Responstid"
            value={`${systemMetrics.responseTime} ms`}
            helper="Gjennomsnittlig svartid"
            tone={{
              bg: 'linear-gradient(180deg, rgba(240,247,255,0.98), rgba(255,255,255,0.98))',
              border: 'rgba(37, 95, 164, 0.18)',
              iconBg: '#e9f2ff',
              iconColor: '#235fa4',
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<Memory />}
            label="Minnebruk"
            value={`${systemMetrics.memoryUsage}%`}
            helper="Høy bruk bør undersøkes før den blir kritisk"
            tone={{
              bg: 'linear-gradient(180deg, rgba(255,247,236,0.98), rgba(255,255,255,0.98))',
              border: 'rgba(160, 90, 0, 0.18)',
              iconBg: '#fff0d8',
              iconColor: '#a05a00',
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <MetricCard
            icon={<Storage />}
            label="Diskbruk"
            value={`${systemMetrics.diskUsage}%`}
            helper="Lagringspress på infrastruktur"
            tone={{
              bg: 'linear-gradient(180deg, rgba(250,244,255,0.98), rgba(255,255,255,0.98))',
              border: 'rgba(110, 69, 184, 0.18)',
              iconBg: '#efe7ff',
              iconColor: '#6e45b8',
            }}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Paper sx={{ ...surfaceSx, p: 2.5 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#181512' }}>
              Tjenesteoversikt
            </Typography>
            <Typography sx={{ mt: 0.5, color: '#6b7280' }}>
              Les tjenestestatus uten å navigere inn i egne monitoreringsflater.
            </Typography>
            <Divider sx={{ my: 2 }} />

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Tjeneste</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Oppetid</strong></TableCell>
                    <TableCell><strong>Siste sjekk</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {services.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Alert severity="info" sx={{ borderRadius: '14px' }}>
                          Ingen tjenestedata tilgjengelig akkurat nå.
                        </Alert>
                      </TableCell>
                    </TableRow>
                  ) : (
                    services.map((service, index) => (
                      <TableRow key={`${service.name}-${index}`}>
                        <TableCell sx={{ fontWeight: 600, color: '#111827' }}>
                          {service.name}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={getStatusColor(service.status)}
                            label={getStatusLabel(service.status)}
                          />
                        </TableCell>
                        <TableCell>{service.uptime}%</TableCell>
                        <TableCell>{service.lastCheck || 'Nå'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <Paper sx={{ ...surfaceSx, p: 2.5 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#181512' }}>
              Siste hendelser
            </Typography>
            <Typography sx={{ mt: 0.5, color: '#6b7280' }}>
              Dette er de driftsignalene som bør leses først.
            </Typography>
            <Divider sx={{ my: 2 }} />

            <List sx={{ p: 0 }}>
              {recentEvents.length === 0 ? (
                <Alert severity="success" sx={{ borderRadius: '14px' }}>
                  Ingen ferske driftsavvik registrert.
                </Alert>
              ) : (
                recentEvents.slice(0, 6).map((event, index) => (
                  <ListItem
                    key={`${event.message}-${index}`}
                    sx={{
                      px: 0,
                      py: 1.25,
                      borderTop: index === 0 ? 'none' : '1px solid rgba(17,24,39,0.08)',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Typography sx={{ fontWeight: 600, color: '#111827' }}>
                            {event.message}
                          </Typography>
                          <Chip
                            size="small"
                            color={getStatusColor(event.type)}
                            label={getStatusLabel(event.type)}
                          />
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#6b7280' }}>
                          {event.time || 'Nylig'}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...surfaceSx, p: 2.5 }}>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#181512' }}>
              Infrastruktur
            </Typography>
            <Typography sx={{ mt: 0.5, color: '#6b7280' }}>
              Les tekniske nøkkeltall før du går inn i dypere feilsøking.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1.25}>
              <Box sx={{ ...insetSx, p: 1.6 }}>
                <Typography sx={{ fontWeight: 700, color: '#111827' }}>
                  CPU-bruk
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: '#6b7280' }}>
                  {systemMetrics.cpuUsage}% aktiv bruk
                </Typography>
              </Box>
              <Box sx={{ ...insetSx, p: 1.6 }}>
                <Typography sx={{ fontWeight: 700, color: '#111827' }}>
                  Databasetilkoblinger
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: '#6b7280' }}>
                  {systemMetrics.databaseConnections} aktive forbindelser
                </Typography>
              </Box>
              <Box sx={{ ...insetSx, p: 1.6 }}>
                <Typography sx={{ fontWeight: 700, color: '#111827' }}>
                  Feilrate
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, color: '#6b7280' }}>
                  {systemMetrics.errorRate}% registrerte feil
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ ...surfaceSx, p: 2.5 }}>
            <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#181512' }}>
              Driftshandlinger
            </Typography>
            <Typography sx={{ mt: 0.5, color: '#6b7280' }}>
              Backup og personvern lever i egne faner, men bør være tilgjengelige herfra.
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1.25}>
              <Box sx={{ ...insetSx, p: 1.6 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#111827' }}>
                      Backup
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: '#6b7280' }}>
                      Gå til full backup-flate for kjøring, kontroll og historikk.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<Backup />}
                    onClick={onOpenBackup}
                    sx={{ borderRadius: '999px' }}
                  >
                    Åpne backup
                  </Button>
                </Stack>
              </Box>
              <Box sx={{ ...insetSx, p: 1.6 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: '#111827' }}>
                      GDPR & personvern
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: '#6b7280' }}>
                      Åpne egen compliance-flate for sletting, samtykke og revisjon.
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<Security />}
                    onClick={onOpenGdpr}
                    sx={{ borderRadius: '999px' }}
                  >
                    Åpne GDPR
                  </Button>
                </Stack>
              </Box>
              <Alert severity={overallStatus === 'error' ? 'error' : 'info'} sx={{ borderRadius: '14px' }}>
                {overallStatus === 'error'
                  ? 'Minst ett kritisk signal er rødt. Prioriter tjenesteoversikten og hendelseslisten først.'
                  : 'Denne flaten er ment som rask driftspuls. Bruk sidefanene for dypere oppfølging.'}
              </Alert>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
