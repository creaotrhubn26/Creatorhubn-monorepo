import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Switch,
  FormControlLabel,
  CircularProgress,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Refresh,
  MonitorHeart,
  Speed as Speed,
  Memory,
  Storage,
  NetworkCheck,
  TrendingUp,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  PlayArrow,
  Stop,
  Timeline,
  SystemUpdate,
} from '@mui/icons-material';

// Function to fetch LSP diagnostics for compilation errors
const fetchLSPDiagnostics = async (): Promise<any[]> => {
  try {
    const response = await fetch('/api/admin/lsp-diagnostics, ');
    if (!response.ok) {
      throw new Error('Failed to fetch LSP diagnostics, ');
    }
    return await response.json();
  } catch (error) {
    console.warn('LSP diagnostics not available: ', error);
    return [];
  }
};

interface LSDDiagnosticResult {
  id: string;
  category: 'syntax' | 'imports' | 'closing_tags' | 'code_quality' | 'compilation';
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'error';
  value: number | string | boolean;
  unit?: string;
  threshold?: {
    warning: number;
    critical: number;
};
  timestamp: Date;
  details?: Record<string, any>;
  businessImpact: 'blocking' | 'degraded' | 'minor' | 'informational';
  filePath?: string;
  lineNumber?: number;
  message?: string;
  severity?: 'error' | 'warning' | 'info' | 'hint';
  // Fix informasjon - hva fiksen innebærer og hva som skal fungere
  fixDescription?: string; // Hva fiksen innebærer
  expectedOutcome?: string; // Hva som skal fungere etter fiksen
  verificationSteps?: string[]; // Steg for å verifisere at fiksen fungerer
  fixedAt?: Date;
  fixedBy?: string;
}

interface LSDSystemSnapshot {
  timestamp: Date;
  totalFiles: number;
  scannedFiles: number;
  codeQuality: {
    syntaxErrors: number;
    importErrors: number;
    closingTagErrors: number;
    compilationErrors: number;
    totalIssues: number;
};
  fileTypes: {
    typescript: number;
    javascript: number;
    jsx: number;
    tsx: number;
    css: number;
    html: number;
};
  severityBreakdown: {
    critical: number;
    warning: number;
    minor: number;
    info: number;
};
  diagnostics: LSDDiagnosticResult[];
}

interface LSDMonitoringStatus {
  isActive: boolean;
  interval: number;
  snapshotCount: number;
  lastSnapshot?: Date;
}

export function LSDMonitoringPanel(): JSX.Element {
  const { auth } = useEnhancedMasterIntegration();
  const user = auth.state.user;

  // Theming system
  const theming = useTheming('prototype_tester');
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ============================================================================
  // API QUERIES
  // ============================================================================

  const { data: monitoringStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/admin/lsd-monitoring/status'],
    refetchInterval: autoRefresh ? 30000 : false,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/lsd-monitoring/status', { headers });
    }
  });

  const { data: currentDiagnostics, isLoading: diagnosticsLoading, refetch: refetchDiagnostics } = useQuery({
    queryKey: ['/api/admin/lsd-monitoring/current'],
    refetchInterval: autoRefresh ? 60000 : false,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/lsd-monitoring/current', { headers });
    }
  });

  const { data: latestSnapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: ['/api/admin/lsd-monitoring/latest'],
    refetchInterval: autoRefresh ? 30000 : false,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/lsd-monitoring/latest', { headers });
    }
  });

  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ['/api/admin/lsd-monitoring/snapshots'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/lsd-monitoring/snapshots?limit=12', { headers });
  },
    refetchInterval: autoRefresh ? 70000 : false
});

  // LSP Diagnostics Query for compilation errors
  const { data: lspDiagnostics, isLoading: lspLoading, refetch: refetchLSP } = useQuery({
    queryKey: ['/api/admin/lsp-diagnostics'],
    queryFn: fetchLSPDiagnostics,
    refetchInterval: autoRefresh ? 45000 : false,
    retry: 1
});

  // Error History Query - historikk over feil som er fikset
  const { data: errorHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/admin/lsd-monitoring/error-history'],
    refetchInterval: autoRefresh ? 120000 : false,
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/lsd-monitoring/error-history', { headers });
    }
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const handleRefresh = () => {
    refetchDiagnostics();
    refetchLSP();
    queryClient.invalidateQueries({ queryKey: ['/api/admin/lsd-monitoring'] });
};

  const startMonitoringMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/lsd-monitoring/start', {
        method: 'POST',
        headers: {
          ...headers,
          "Content-Type" : "application/json"
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/lsd-monitoring/status'] });
      console.log('✅ LSD Monitoring started successfully');
    },
  });

  const stopMonitoringMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/lsd-monitoring/stop', {
        method: 'POST',
        headers: {
          ...headers,
          "Content-Type" : "application/json"
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/lsd-monitoring/status'] });
      console.log('✅ LSD Monitoring stopped successfully');
    },
  });

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return theme.palette.success.main;
      case 'warning': return theme.palette.warning.main;
      case 'critical': return theme.palette.error.main;
      case 'error': return theme.palette.error.dark;
      default: return theme.palette.grey[500];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle sx={{ color: theme.palette.success.main }} />;
      case 'warning': return <Warning sx={{ color: theme.palette.warning.main }} />;
      case 'critical': return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      case 'error': return <ErrorIcon sx={{ color: theme.palette.error.dark }} />;
      default: return <MonitorHeart sx={{ color: theme.palette.grey[500] }} />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'syntax': return <ErrorIcon />;
      case 'imports': return <NetworkCheck />;
      case 'closing_tags': return <SystemUpdate />;
      case 'code_quality': return <Speed />;
      case 'compilation': return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      default: return <MonitorHeart />;
    }
  };

  // Process LSP diagnostics to detect compilation errors
  const compilationErrors = React.useMemo(() => {
    if (!lspDiagnostics || !Array.isArray(lspDiagnostics)) return [];
    
    return lspDiagnostics
      .filter(diagnostic => 
        diagnostic.severity === 'error' || 
        (diagnostic.severity === 'warning' && diagnostic.message?.includes('compilation'))
      )
      .map(diagnostic => {
        // Generate detailed fix information based on error type
        const generateFixInfo = (message: string, file: string) => {
          if (message.includes('Cannot access') && message.includes('before initialization')) {
            return {
              fixDescription: '🔧 Flytt variabel-deklarasjonen før den brukes i koden. Dette skjer når variabler refereres til før de er initialisert.',
              expectedOutcome: '✅ Komponenten skal rendre uten feil, alle funksjoner skal være tilgjengelige, og interaktive elementer skal fungere normalt.',
              verificationSteps: [
                'Kontroller at komponenten lastes uten feil i nettleseren','Test alle interaktive funksjoner i komponenten','Verifiser at ingen console-errors vises','Sjekk at alle click-handlers og event-listeners fungerer'
              ]
            };
          }
          if (message.includes('module') || message.includes('import') || message.includes('Cannot resolve')) {
            return {
              fixDescription: '🔧 Korriger import-banen eller installer manglende avhengighet. Dette kan være feil filbane, manglende pakke eller feil eksport.',
              expectedOutcome: '✅ Modulen skal importeres korrekt, alle avhengigheter skal være tilgjengelige, og TypeScript-kompileringen skal lykkes.',
              verificationSteps: [
                'Kontroller at filen kompilerer uten feil','Verifiser at alle imports er grønne i IDE','Test at funksjonaliteten fra importert modul fungerer','Sjekk at npm/yarn install er kjørt hvis ny pakke trengs'
              ]
            };
          }
          if (message.includes('Type') && (message.includes('missing') || message.includes('not assignable'))) {
            return {
              fixDescription: '🔧 Korriger TypeScript-typer. Legg til manglende type-definisjoner eller endre typer for å matche forventet interface.',
              expectedOutcome: '✅ TypeScript-kompileringen skal lykkes, alle type-sjekker skal passere, og koden skal være type-sikker.',
              verificationSteps: [
                'Kontroller at TypeScript-kompileringen lykkes','Verifiser at alle type-feil er løst','Test at funksjonaliteten fungerer som forventet','Sjekk at IDE viser grønne type-sjekker'
              ]
            };
          }
          if (message.includes('syntax') || message.includes('Unexpected')) {
            return {
              fixDescription: '🔧 Korriger syntaks-feil. Dette kan være manglende parantes, ekstra kommaer, eller feil JavaScript/TypeScript-syntaks.',
              expectedOutcome: '✅ Koden skal parseiere korrekt, kompilere uten feil, og fungere som forventet i nettleseren.',
              verificationSteps: [
                'Kontroller at syntaks-feilene er rettet','Verifiser at filen kompilerer','Test at applikasjonens funksjonalitet er intakt','Sjekk at linting-regler er oppfylt'
              ]
            };
          }
          // Default for ukjente feil
          return {
            fixDescription: '🔧 Analyser og korriger feil i henhold til feilmeldingen. Sjekk dokumentasjon og best practices.',
            expectedOutcome: '✅ Koden skal kompilere uten feil og fungere som forventet etter rettelse.',
            verificationSteps: [
              'Analyser feilmeldingen grundig','Implementer foreslått løsning','Test at applikasjonens funksjonalitet fungerer','Verifiser at ingen nye feil er introdusert'
            ]
          };
        };
        
        const fixInfo = generateFixInfo(diagnostic.message || ', ', diagnostic.file || ', ');
        
        return {
          id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category: 'compilation' as const,
          name: `Kompileringsfeil: ${diagnostic.file || 'Ukjent fil'}`,
          status: diagnostic.severity === 'error' ? 'critical' as const : 'warning' as const,
          value: 1,
          timestamp: new Date(),
          businessImpact: diagnostic.severity === 'error' ? 'blocking' as const : 'degraded' as const,
          filePath: diagnostic.file,
          lineNumber: diagnostic.line,
          message: diagnostic.message,
          severity: diagnostic.severity,
          ...fixInfo,
          details: {
            range: diagnostic.range,
            source: diagnostic.source || 'TypeScript',
            type: 'compilation_error'
          }
        };
      });
  }, [lspDiagnostics]);

  // Combine all diagnostics including compilation errors
  const allDiagnostics = React.useMemo(() => {
    const current = currentDiagnostics?.diagnostics || [];
    return [...current, ...compilationErrors];
}, [currentDiagnostics, compilationErrors]);

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

  const formatValue = (value: number | string | boolean, unit?: string): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') return value;
    return unit ? `${value} ${unit}` : value.toString();
};

  // ============================================================================
  // RENDER COMPONENTS
  // ============================================================================

  const renderSystemOverview = () => {
    if (!latestSnapshot) return null;

    const snapshot = latestSnapshot as LSDSystemSnapshot;
    const criticalCount = snapshot.codeQuality?.totalIssues || 0;
    const scanProgress = snapshot.totalFiles > 0 ? (snapshot.scannedFiles / snapshot.totalFiles) * 100 : 0;

    return (
      <Grid container spacing={2}>
        {/* Syntax Errors */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <ErrorIcon sx={{ mr: 1, color: theme.palette.error.main }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Syntax Errors</Typography>
              </Box>
              <Typography variant="h4" color={snapshot.codeQuality?.syntaxErrors > 0 ? 'error' : 'success'}>
                {snapshot.codeQuality?.syntaxErrors || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Parsing issues found
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Import Errors */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <NetworkCheck sx={{ mr: 1, color: theme.palette.warning.main }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Import Errors</Typography>
              </Box>
              <Typography variant="h4" color={snapshot.codeQuality?.importErrors > 0 ? 'error' : 'success'}>
                {snapshot.codeQuality?.importErrors || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Missing dependencies
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Closing Tag Errors */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SystemUpdate sx={{ mr: 1, color: theme.palette.info.main }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Closing Tags</Typography>
              </Box>
              <Typography variant="h4" color={snapshot.codeQuality?.closingTagErrors > 0 ? 'error' : 'success'}>
                {snapshot.codeQuality?.closingTagErrors || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Unclosed JSX/HTML tags
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Scan Progress */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TrendingUp sx={{ mr: 1, color: theme.palette.primary.main }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Scan Progress</Typography>
              </Box>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {scanProgress.toFixed(0)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={scanProgress}
                sx={{ mt: 1 }}
              />
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {snapshot.scannedFiles}/{snapshot.totalFiles} files
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
};

  const renderFileTypesStatus = () => {
    if (!latestSnapshot) return null;

    const snapshot = latestSnapshot as LSDSystemSnapshot;
    const fileTypes = snapshot.fileTypes;

    return (
      <Grid container spacing={2}>
        {Object.entries(fileTypes).map(([fileType, count]) => (
          <Grid item xs={12} sm={6} md={2} key={fileType}>
            <Card>
              <CardContent>
                <Box display="flex" flexDirection="column" alignItems="center">
                  {getCategoryIcon(fileType)}
                  <Typography variant="subtitle1" sx={{ textTransform: 'capitalize', mt: 1 }}>
                    {fileType.replace('script', ', ').toUpperCase()}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                    {count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    files scanned
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
};

  const renderDiagnosticsTable = () => {
    if (!currentDiagnostics?.diagnostics) return null;

    const diagnostics = currentDiagnostics.diagnostics as LSDDiagnosticResult[];

    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>File</TableCell>
              <TableCell>Issue</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Line</TableCell>
              <TableCell>Impact</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {diagnostics.map((diagnostic) => (
              <TableRow key={diagnostic.id}>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    {getCategoryIcon(diagnostic.category)}
                    <Typography variant="body2" sx={{ ml: 1, textTransform: 'capitalize' }}>
                      {diagnostic.category}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{diagnostic.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={diagnostic.status.toUpperCase()}
                    color={
                      diagnostic.status === 'healthy' ? 'success' : 
                      diagnostic.status === 'warning' ? 'warning' : 'error'
                  }
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={
                    diagnostic.status === 'critical' ? 'error' : 
                    diagnostic.status === 'warning' ? 'warning' : 'inherit'
                }>
                    {formatValue(diagnostic.value, diagnostic.unit)}
                  </Typography>
                  {diagnostic.threshold && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      Warning: {diagnostic.threshold.warning} {diagnostic.unit}, 
                      Critical: {diagnostic.threshold.critical} {diagnostic.unit}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={diagnostic.businessImpact}
                    size="small"
                    color={
                      diagnostic.businessImpact === 'blocking' ? 'error' :
                      diagnostic.businessImpact === 'degraded' ? 'warning' : 'default'
                  }
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {new Date(diagnostic.timestamp).toLocaleTimeString('no-NO')}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
};

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <MonitorHeart sx={{ mr: 2, fontSize: 32, color: theme.palette.primary.main }} />
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: theming.colors.primary }}>
              LSD Monitoring System
            </Typography>
            <Typography variant="subtitle1" color="textSecondary">
              Live System Diagnostics - Load, State & Dependencies
            </Typography>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                color="primary"
              />
          }
            label="Auto Refresh"
          />
          
          <Tooltip title="Refresh All Data">
            <IconButton
              onClick={() => {
                refetchDiagnostics();
                queryClient.invalidateQueries({ queryKey: ['/api/admin/lsd-monitoring'] });
            }}
              disabled={diagnosticsLoading}
            >
              {diagnosticsLoading ? <CircularProgress size={24} /> : <Refresh />}
            </IconButton>
          </Tooltip>

          {monitoringStatus?.isActive ? (
            <Button
              variant="outlined"
              color="error"
              startIcon=<Stop />
              onClick={() => stopMonitoringMutation.mutate()}
              disabled={stopMonitoringMutation.isPending}
            >
              Stop Monitoring
            </Button>
          ) : (
            <Button variant="contained"
              color="primary"
              startIcon=<PlayArrow />
              onClick={() => startMonitoringMutation.mutate()}
              disabled={startMonitoringMutation.isPending}
            >
              Start Monitoring
            </Button>
          )}
        </Box>
      </Box>

      {/* Status Alert */}
      {monitoringStatus && (
        <Alert
          severity={monitoringStatus.isActive ? "success" : "warning"}
          sx={{ mb:  3 }}
        >
          <Typography variant="body2">
            LSD Monitoring is <strong>{monitoringStatus.isActive ? 'ACTIVE' : 'INACTIVE'}</strong>
            {monitoringStatus.isActive && (
              <>
                {', '}- Monitoring every {Math.floor(monitoringStatus.interval / 60000)} minutes
                {', '}- {monitoringStatus.snapshotCount} snapshots collected
                {monitoringStatus.lastSnapshot && (
                  <> - Last check: {new Date(monitoringStatus.lastSnapshot).toLocaleString('no-NO')}</>
                )}
              </>
            )}
          </Typography>
        </Alert>
      )}

      {/* System Overview */}
      <Paper sx={{ p: 3, mb:  3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          System Overview
        </Typography>
        {snapshotLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          renderSystemOverview()
        )}
      </Paper>

      {/* Dependencies Status */}
      <Paper sx={{ p: 3, mb:  3 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Dependencies Status
        </Typography>
        {snapshotLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Alert severity="info">
            Dependencies monitoring is currently being implemented.
          </Alert>
        )}
      </Paper>

      {/* Diagnostics Summary */}
      {currentDiagnostics?.summary && (
        <Paper sx={{ p: 3, mb:  3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Current Diagnostics Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="success.main" sx={{ color: theming.colors.primary }}>
                  {currentDiagnostics.summary.healthy}
                </Typography>
                <Typography variant="body2">Healthy</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="warning.main" sx={{ color: theming.colors.primary }}>
                  {currentDiagnostics.summary.warning}
                </Typography>
                <Typography variant="body2">Warning</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="error.main" sx={{ color: theming.colors.primary }}>
                  {currentDiagnostics.summary.critical}
                </Typography>
                <Typography variant="body2">Critical</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box textAlign="center">
                <Typography variant="h3" color="error.dark" sx={{ color: theming.colors.primary }}>
                  {currentDiagnostics.summary.error}
                </Typography>
                <Typography variant="body2">Error</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Detailed Diagnostics Table */}
      <Paper sx={{ p:  3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Detailed Diagnostics
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {currentDiagnostics?.timestamp && 
              `Last updated: ${new Date(currentDiagnostics.timestamp).toLocaleString('no-NO')}`
          }
          </Typography>
        </Box>
        
        {diagnosticsLoading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          renderDiagnosticsTable()
        )}
      </Paper>
    </Box>
  );
}
