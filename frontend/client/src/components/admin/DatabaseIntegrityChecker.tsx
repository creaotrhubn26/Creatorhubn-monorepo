import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Build as RepairIcon,
  Schedule as ScheduleIcon,
  Storage as DatabaseIcon,
  Assessment as ReportIcon,
  AutoMode as AutoSyncIcon,
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

// ✅ DATABASE INTEGRITY CHECKER COMPONENT
// Visuell monitorering av database integritet med automatisk sjekking hver 3. time

interface DatabaseIntegrityResult {
  status: 'healthy' | 'warning' | 'error';
  missingTables: string[];
  missingColumns: { table: string; columns: string[] }[];
  extraTables: string[];
  errors: string[];
  lastChecked: Date;
  nextCheck: Date;
  autoSyncEnabled?: boolean;
  lastAutoSync?: Date;
  autoSyncStatus?: 'idle' | 'running' | 'completed' | 'failed';
}

export default function DatabaseIntegrityChecker() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const queryClient = useQueryClient();

  const [isHelperSleeping, setIsHelperSleeping] = useState(false);
  const [lastHelperActivity, setLastHelperActivity] = useState(Date.now());
  
  // Sleep mode for helper - much longer timeouts to conserve resources
  const HELPER_SLEEP_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity
  const HELPER_ACTIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes when active
  const HELPER_SLEEP_INTERVAL = 60 * 60 * 1000; // 1 hour when sleeping

  // Automatic sleep detection for helper
  React.useEffect(() => {
    const checkHelperActivity = setInterval(() => {
      if (Date.now() - lastHelperActivity > HELPER_SLEEP_TIMEOUT) {
        setIsHelperSleeping(true);
        console.log('💤 Database Integrity Checker (Helper) entering sleep mode to conserve resources');
      }
    }, 2 * 60 * 1000); // Check every 2 minutes

    return () => clearInterval(checkHelperActivity);
  }, [lastHelperActivity]);

  const wakeUpHelper = React.useCallback(() => {
    if (isHelperSleeping) {
      setIsHelperSleeping(false);
      setLastHelperActivity(Date.now());
      console.log('⏰ Database Integrity Checker (Helper) waking up from sleep mode');
    } else {
      setLastHelperActivity(Date.now());
    }
  }, [isHelperSleeping]);

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Hent AUTO-SYNC status - reduced frequency for helper role
  const { data: autoSyncStatus } = useQuery({
    queryKey: ['/api/admin/database/auto-sync-status,'],
    refetchInterval: isHelperSleeping ? HELPER_SLEEP_INTERVAL : HELPER_ACTIVE_INTERVAL,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/database/auto-sync-status,', { headers });
    },
    staleTime: 10 * 60 * 1000, // 10 minutes stale time
    enabled: !isHelperSleeping, // Disable when sleeping
  });

  // Hent current integrity status - much less frequent for helper role
  const { data: integrityStatus, isLoading, error } = useQuery({
    queryKey: ['/api/admin/database/integrity-status'],
    refetchInterval: isHelperSleeping ? HELPER_SLEEP_INTERVAL : HELPER_ACTIVE_INTERVAL,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/database/integrity-status', { headers });
    },
    staleTime: 15 * 60 * 1000, // 15 minutes stale time for helper
    retry: 1,
    enabled: !isHelperSleeping, // Disable when sleeping
  });

  // Manual integrity check - wake up helper before action
  const manualCheckMutation = useMutation({
    mutationFn: () => {
      wakeUpHelper(); // Wake up before intensive operation
      return apiRequest('/api/admin/database/integrity-check', {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': user?.email || ', '
        },
        
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/integrity-status'] });
    }
  });

  // AUTO-SYNC control mutations
  const autoSyncToggleMutation = useMutation({
    mutationFn: (action: 'enable' | 'disable') => apiRequest(`/api/admin/database/auto-sync/${action}`, {
        headers: {
          'X-Google-Impersonation' : 'true','X-User-Email': user?.email || ', '
        },
        
      method: 'POST'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/auto-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/integrity-status'] });
    }
  });

  // Database repair
  const repairMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/database/repair', {
        headers: {
          'X-Google-Impersonation' : 'true', 'X-User-Email': user?.email || ', '
        },
        
      method: 'POST'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/database/integrity-status'] });
    }
  });

  // Start/stop monitoring
  const monitoringMutation = useMutation({
    mutationFn: (action: 'start' | 'stop') => 
      apiRequest(`/api/admin/database/integrity-monitor/${action}`, {
        headers: {
          'X-Google-Impersonation' : 'true', 'X-User-Email': user?.email || ', '
        },
        
        method: 'POST'
      }),
    onSuccess: (data, action) => {
      setIsMonitoring(action === 'start');
    }
  });

  // Besteem status color og icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'healthy': return { color: 'success', icon: <CheckIcon />, label: 'Sunn' };
      case 'warning': return { color: 'warning', icon: <WarningIcon />, label: 'Advarsel' };
      case 'error': return { color: 'error', icon: <ErrorIcon />, label: 'Kritisk' };
      default: return { color: 'info', icon: <DatabaseIcon />, label: 'Ukjent' };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('no-NO');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
        <CircularProgress size={24} />
        <Typography>Sjekker database integritet...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Database Integrity Checker Error</Typography>
        <Typography>Kunne ikke hente integritetsstatusden: {error.message}</Typography>
      </Alert>
    );
  }

  const status = integrityStatus?.status || 'unknown';
  const statusDisplay = getStatusDisplay(status);

  return (
    <Box sx={{ p: 3 }}>
      {/* Sleep Mode Alert for Helper */}
      {isHelperSleeping && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 2, 
            backgroundColor: 'rgba(1, 5, 6, 391, 76, 0.08)',
            border: '2px solid rgba(1, 5, 6, 391, 76, 0.3)'}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              backgroundColor: '#9c27b0',
              animation: 'blink 2s infinite'
            }} />
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              💤 Database Integrity Checker (Helper) - Ressursbesparende hvilemodus aktiv
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Header med status oversikt */}
      <Card sx={{ mb: 3, opacity: isHelperSleeping ? 0.7 : 1, transition: 'opacity 0.3s' }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <DatabaseIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h5" fontWeight={600}>
                    Database Integrity Checker (Helper)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Støtter DB Doctor - Automatisk overvåkning med ressursbesparelse
                  </Typography>
                  <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                    <Typography variant="caption">
                      ℹ️ DB Doctor er hovedløsningen for database-utfordringer. Denne helper-komponenten gir tilleggsstatistikk.
                    </Typography>
                  </Alert>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Chip
                  icon={statusDisplay.icon}
                  label={`Status: ${statusDisplay.label}`}
                  color={statusDisplay.color as any}
                  variant="filled"
                  size="medium"
                />
                <Chip
                  icon={autoSyncStatus?.autoSyncEnabled ? <SyncIcon /> : <SyncDisabledIcon />}
                  label={autoSyncStatus?.autoSyncEnabled ? 'AUTO-SYNC: AKT' : 'AUTO-SYNC: DEAKT'}
                  color={autoSyncStatus?.autoSyncEnabled ? 'success' : 'default'}
                  variant="outlined"
                  size="medium"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Kontrollpanel
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => {
                wakeUpHelper();
                manualCheckMutation.mutate();
              }}
              disabled={manualCheckMutation.isPending}
            >
              {manualCheckMutation.isPending ? 'Sjekker...' : isHelperSleeping ? 'Wake & Check' : 'Manuell Sjekk'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={isHelperSleeping ? <PlayArrow /> : <Schedule />}
              onClick={() => setIsHelperSleeping(!isHelperSleeping)}
              sx={{ 
                borderColor: isHelperSleeping ? '#9c27b0' : '#1976d2',
                color: isHelperSleeping ? '#9c27b0' : '#1976d2'
              }}>
              {isHelperSleeping ? 'Wake Helper' : 'Sleep Mode'}
            </Button>
            
            <Button
              variant="outlined"
              startIcon={isMonitoring ? <StopIcon /> : <StartIcon />}
              onClick={() => monitoringMutation.mutate(isMonitoring ? 'stop' : 'start')}
              disabled={monitoringMutation.isPending}
            >
              {isMonitoring ? 'Stopp Overvåkning' : 'Start Overvåkning'}
            </Button>

            {/* AUTO-SYNC kontroller */}
            <Button
              variant="contained"
              color={autoSyncStatus?.autoSyncEnabled ? "success" : "secondary"}
              startIcon={autoSyncStatus?.autoSyncEnabled ? <AutoSyncIcon /> : <SyncDisabledIcon />}
              onClick={() => autoSyncToggleMutation.mutate(
                autoSyncStatus?.autoSyncEnabled ? 'disable' : 'enable')}
              disabled={autoSyncToggleMutation.isPending}
            >
              {autoSyncToggleMutation.isPending ? 'Endrer...' : autoSyncStatus?.autoSyncEnabled ? 'Deaktiver AUTO-SYNC' : 'Aktiver AUTO-SYNC'}
            </Button>

            {status === 'error' && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<RepairIcon />}
                onClick={() => repairMutation.mutate()}
                disabled={repairMutation.isPending}
              >
                {repairMutation.isPending ? 'Reparerer...' : 'Automatisk Reparasjon'}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Status details */}
      {integrityStatus && (
        <Grid container spacing={3}>
          {/* Siste sjekk info */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Siste Sjekk
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <ScheduleIcon color="action" />
                  <Typography>
                    {formatTimestamp(integrityStatus.lastChecked)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Neste sjekk: {formatTimestamp(integrityStatus.nextCheck)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Statistikk */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Statistikk
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Manglende tabeller:</Typography>
                    <Chip 
                      label={integrityStatus.missingTables?.length || 0}
                      size="small" 
                      color={integrityStatus.missingTables?.length > 0 ? 'error' : 'success'}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Tabeller med manglende kolonner:</Typography>
                    <Chip 
                      label={integrityStatus.missingColumns?.length || 0}
                      size="small" 
                      color={integrityStatus.missingColumns?.length > 0 ? 'error' : 'success'}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Ekstra tabeller:</Typography>
                    <Chip 
                      label={integrityStatus.extraTables?.length || 0}
                      size="small" 
                      color={integrityStatus.extraTables?.length > 0 ? 'warning' : 'success'}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Detaljerte problemer */}
          {(integrityStatus.missingTables?.length > 0 || 
            integrityStatus.missingColumns?.length > 0 || 
            integrityStatus.errors?.length > 0) && (
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="error">
                    Funnet Problemer
                  </Typography>
                  
                  {integrityStatus.missingTables?.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Manglende Tabeller: </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {integrityStatus.missingTables.map((table: string) => (
                          <Chip key={table} label={table} color="error" size="small" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {integrityStatus.missingColumns?.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Manglende Kolonner: </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Tabell</TableCell>
                              <TableCell>Manglende Kolonner</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {integrityStatus.missingColumns.map((item: unknown) => (
                              <TableRow key={item.table}>
                                <TableCell>{item.table}</TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {item.columns.map((col: string) => (
                                      <Chip key={col} label={col} color="error" size="small" />
                                    ))}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {integrityStatus.errors?.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Feilmeldinger: </Typography>
                      {integrityStatus.errors.map((error: string, index: number) => (
                        <Alert key={index} severity="error" sx={{ mb: 1 }}>
                          {error}
                        </Alert>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Sunn database melding */}
          {status === 'healthy' && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="success" sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckIcon sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    Database Integritet OK
                  </Typography>
                  <Typography>
                    Alle tabeller og kolonner stemmer overens med schema. Automatisk overvåkning aktiv.
                  </Typography>
                </Box>
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Progress indicators */}
      {(manualCheckMutation.isPending || repairMutation.isPending) && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
            {manualCheckMutation.isPending && 'Utfører integritetskontroll...'}
            {repairMutation.isPending &&'Utfører database reparasjon...'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}