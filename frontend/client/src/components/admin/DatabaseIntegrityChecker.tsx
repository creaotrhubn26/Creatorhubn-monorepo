import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, getAuthHeader } from '@/lib/queryClient';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  AutoMode as AutoModeIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Storage as DatabaseIcon,
  SyncDisabled as SyncDisabledIcon,
  Warning as WarningIcon,
  Build as RepairIcon,
} from '@mui/icons-material';
import {
  AdminCard,
  AdminButton,
  AdminLoading,
  AdminTableContainer,
} from './design-system';

type IntegrityState = 'healthy' | 'warning' | 'error' | 'unknown';
type AutoSyncState = 'idle' | 'running' | 'completed' | 'failed';
type MonitorAction = 'start' | 'stop';
type ToggleAction = 'enable' | 'disable';

interface MissingColumn {
  table: string;
  columns: string[];
}

interface IntegrityStatus {
  status: IntegrityState;
  missingTables: string[];
  missingColumns: MissingColumn[];
  extraTables: string[];
  errors: string[];
  lastChecked?: string;
  nextCheck?: string;
  autoSyncEnabled?: boolean;
  autoSyncStatus?: AutoSyncState;
}

interface AutoSyncStatus {
  autoSyncEnabled: boolean;
  autoSyncStatus?: AutoSyncState;
  lastAutoSync?: string;
}

type StatusDisplay = {
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
  icon: React.ReactElement;
};

async function requestWithUserHeaders(url: string, method: 'GET' | 'POST', userEmail?: string) {
  const headers = await getAuthHeader();
  const mergedHeaders: Record<string, string> = {
    ...headers,
    'X-Google-Impersonation': 'true',
  };
  if (userEmail) {
    mergedHeaders['X-User-Email'] = userEmail;
  }
  return apiRequest(url, { method, headers: mergedHeaders });
}

export default function DatabaseIntegrityChecker() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userEmail = user?.email;

  const [isMonitoring, setIsMonitoring] = useState(false);

  const {
    data: autoSyncStatus,
    isLoading: autoSyncLoading,
    error: autoSyncError,
  } = useQuery<AutoSyncStatus>({
    queryKey: ['/api/admin/database/auto-sync-status'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => requestWithUserHeaders('/api/admin/database/auto-sync-status', 'GET', userEmail),
  });

  const {
    data: integrityStatus,
    isLoading: integrityLoading,
    error: integrityError,
  } = useQuery<IntegrityStatus>({
    queryKey: ['/api/admin/database/integrity-status'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => requestWithUserHeaders('/api/admin/database/integrity-status', 'GET', userEmail),
  });

  const manualCheckMutation = useMutation({
    mutationFn: () => requestWithUserHeaders('/api/admin/database/integrity-check', 'POST', userEmail),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/database/integrity-status'] });
    },
  });

  const repairMutation = useMutation({
    mutationFn: () => requestWithUserHeaders('/api/admin/database/repair', 'POST', userEmail),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/database/integrity-status'] });
    },
  });

  const monitoringMutation = useMutation({
    mutationFn: (action: MonitorAction) =>
      requestWithUserHeaders(`/api/admin/database/integrity-monitor/${action}`, 'POST', userEmail),
    onSuccess: (_data, action) => {
      setIsMonitoring(action === 'start');
    },
  });

  const autoSyncToggleMutation = useMutation({
    mutationFn: (action: ToggleAction) =>
      requestWithUserHeaders(`/api/admin/database/auto-sync/${action}`, 'POST', userEmail),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/database/auto-sync-status'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/database/integrity-status'] });
    },
  });

  const statusDisplay = useMemo<StatusDisplay>(() => {
    const status = integrityStatus?.status ?? 'unknown';
    if (status === 'healthy') {
      return { label: 'Sunn', color: 'success', icon: <CheckIcon /> };
    }
    if (status === 'warning') {
      return { label: 'Advarsel', color: 'warning', icon: <WarningIcon /> };
    }
    if (status === 'error') {
      return { label: 'Kritisk', color: 'error', icon: <ErrorIcon /> };
    }
    return { label: 'Ukjent', color: 'default', icon: <DatabaseIcon /> };
  }, [integrityStatus?.status]);

  const isBusy =
    manualCheckMutation.isPending ||
    repairMutation.isPending ||
    monitoringMutation.isPending ||
    autoSyncToggleMutation.isPending;

  const formatTimestamp = (value?: string) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('no-NO');
  };

  const missingTables = Array.isArray(integrityStatus?.missingTables) ? integrityStatus.missingTables : [];
  const missingColumns = Array.isArray(integrityStatus?.missingColumns) ? integrityStatus.missingColumns : [];
  const extraTables = Array.isArray(integrityStatus?.extraTables) ? integrityStatus.extraTables : [];
  const errors = Array.isArray(integrityStatus?.errors) ? integrityStatus.errors : [];

  if (integrityLoading && !integrityStatus) {
    return <AdminLoading label="Laster database integritetsstatus..." />;
  }

  return (
    <Box sx={{ p: 2 }}>
      {(integrityError || autoSyncError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Kunne ikke laste status</Typography>
          <Typography variant="body2">
            {(integrityError as Error | null)?.message ?? (autoSyncError as Error | null)?.message}
          </Typography>
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={7}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <DatabaseIcon color="primary" />
                <Box>
                  <Typography variant="h6">Database Integrity Checker</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Live integritetskontroll, auto-sync og reparasjon
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1, flexWrap: 'wrap' }}>
                <Chip icon={statusDisplay.icon} label={`Status: ${statusDisplay.label}`} color={statusDisplay.color} />
                <Chip
                  icon={autoSyncStatus?.autoSyncEnabled ? <AutoModeIcon /> : <SyncDisabledIcon />}
                  label={autoSyncStatus?.autoSyncEnabled ? 'AUTO-SYNC AKTIV' : 'AUTO-SYNC AV'}
                  color={autoSyncStatus?.autoSyncEnabled ? 'success' : 'default'}
                  variant="outlined"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <AdminCard title="Kontrollpanel" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <AdminButton
              tone="primary"
              loading={manualCheckMutation.isPending}
              startIcon={<RefreshIcon />}
              onClick={() => manualCheckMutation.mutate()}
              disabled={manualCheckMutation.isPending}
            >
              {manualCheckMutation.isPending ? 'Kjører sjekk...' : 'Manuell Sjekk'}
            </AdminButton>

            <AdminButton
              tone="secondary"
              startIcon={<PlayArrowIcon />}
              onClick={() => monitoringMutation.mutate(isMonitoring ? 'stop' : 'start')}
              disabled={monitoringMutation.isPending}
            >
              {isMonitoring ? 'Stopp overvåkning' : 'Start overvåkning'}
            </AdminButton>

            <Button
              variant="contained"
              color={autoSyncStatus?.autoSyncEnabled ? 'success' : 'secondary'}
              startIcon={autoSyncStatus?.autoSyncEnabled ? <AutoModeIcon /> : <SyncDisabledIcon />}
              onClick={() =>
                autoSyncToggleMutation.mutate(autoSyncStatus?.autoSyncEnabled ? 'disable' : 'enable')
              }
              disabled={autoSyncToggleMutation.isPending || autoSyncLoading}
            >
              {autoSyncStatus?.autoSyncEnabled ? 'Deaktiver auto-sync' : 'Aktiver auto-sync'}
            </Button>

            <Button
              variant="outlined"
              color="warning"
              startIcon={<RepairIcon />}
              onClick={() => repairMutation.mutate()}
              disabled={repairMutation.isPending}
            >
              {repairMutation.isPending ? 'Reparerer...' : 'Reparer database'}
            </Button>
          </Box>
      </AdminCard>

      {isBusy && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <AdminCard title="Siste sjekk">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ScheduleIcon fontSize="small" color="action" />
                <Typography variant="body2">{formatTimestamp(integrityStatus?.lastChecked)}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Neste sjekk: {formatTimestamp(integrityStatus?.nextCheck)}
              </Typography>
              {autoSyncStatus?.lastAutoSync && (
                <Typography variant="body2" color="text.secondary">
                  Siste auto-sync: {formatTimestamp(autoSyncStatus.lastAutoSync)}
                </Typography>
              )}
          </AdminCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <AdminCard title="Statistikk">
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Manglende tabeller</Typography>
                  <Chip size="small" label={missingTables.length} color={missingTables.length > 0 ? 'error' : 'success'} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Manglende kolonner</Typography>
                  <Chip size="small" label={missingColumns.length} color={missingColumns.length > 0 ? 'error' : 'success'} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Ekstra tabeller</Typography>
                  <Chip size="small" label={extraTables.length} color={extraTables.length > 0 ? 'warning' : 'success'} />
                </Box>
              </Box>
          </AdminCard>
        </Grid>

        {missingTables.length > 0 && (
          <Grid item xs={12}>
            <AdminCard title="Manglende tabeller">
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {missingTables.map((table) => (
                    <Chip key={table} size="small" label={table} color="error" />
                  ))}
                </Box>
            </AdminCard>
          </Grid>
        )}

        {missingColumns.length > 0 && (
          <Grid item xs={12}>
            <AdminCard title="Manglende kolonner" disablePadding>
                <AdminTableContainer ariaLabel="Manglende kolonner">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tabell</TableCell>
                        <TableCell>Kolonner</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {missingColumns.map((entry) => (
                        <TableRow key={entry.table}>
                          <TableCell>{entry.table}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {(Array.isArray(entry.columns) ? entry.columns : []).map((column) => (
                                <Chip key={`${entry.table}.${column}`} size="small" label={column} color="error" />
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AdminTableContainer>
            </AdminCard>
          </Grid>
        )}

        {errors.length > 0 && (
          <Grid item xs={12}>
            <AdminCard title="Feilmeldinger">
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {errors.map((message, index) => (
                    <Alert key={`integrity-error-${index}`} severity="error">
                      {message}
                    </Alert>
                  ))}
                </Box>
            </AdminCard>
          </Grid>
        )}

        {(missingTables.length === 0 && missingColumns.length === 0 && errors.length === 0) && (
          <Grid item xs={12}>
            <Alert severity="success" icon={<CheckIcon />}>
              Database integrity ser bra ut. Ingen problemer funnet i siste sjekk.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
