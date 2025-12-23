import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Chip,
  Stack,
  Grid,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Folder,
  Settings,
  PlayArrow,
  Stop,
  Refresh,
  CheckCircle,
  Error,
  VideoLibrary,
  CloudUpload,
  Info,
  Timeline,
  Visibility,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface AutoMonitorStatus {
  activeMonitors: Array<{
    userId: string;
    monitorFolderName: string;
    checkIntervalMinutes: number;
    autoGenerateSettings: {
      enabled: boolean;
      templateType: string;
      emotionalCurve: string;
      targetDuration: number;
    };
  }>;
  processedFiles: {
    [folderName: string]: Array<{
      fileId: string;
      fileName: string;
      mimeType: string;
      uploadedAt: string;
      processed: boolean;
      storyArcId?: string;
      processingError?: string;
      contentAnalysis?: {
        contentType: string;
        confidence: number;
        detectedElements: string[];
      };
      intelligentSettings?: {
        detectedType: string;
        confidence: number;
        usedSettings: {
          templateType: string;
          emotionalCurve: string;
          targetDuration: number;
        };
      };
    }>;
  };
}

interface StoryArcAutoMonitorProps {
  userId: string;
  onStatusChange?: (enabled: boolean) => void
}

const StoryArcAutoMonitor: React.FC<StoryArcAutoMonitorProps> = ({ userId, onStatusChange }) => {
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [autoSettings, setAutoSettings] = useState({
    templateType: 'wedding',
    emotionalCurve: 'rising',
    targetDuration: 40, // 8 minutes
    checkIntervalMinutes:  5,
});

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Get monitoring status
  const { 
    data: monitorStatus, 
    isLoading: isLoadingStatus,
    refetch: refetchStatus 
  } = useQuery<AutoMonitorStatus>({
    queryKey: ['/api/story-arc/auto-monitor/status', userId],
    queryFn: () => apiRequest(`/api/story-arc/auto-monitor/status/${userId}`),
    retry: false,
  });

  // Get processing history
  const { 
    data: processingHistory, 
    isLoading: isLoadingHistory,
    refetch: refetchHistory 
  } = useQuery({
    queryKey: ['/api/story-arc/auto-monitor/history', userId],
    queryFn: () => apiRequest(`/api/story-arc/auto-monitor/history/${userId}`),
    enabled: historyOpen,
    retry: false,
  });

  // Enable monitoring mutation
  const enableMonitoring = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest('/api/story-arc/auto-monitor/enable', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          userId,
          monitorFolderName: 'studio_arc_create',
          checkIntervalMinutes: settings.checkIntervalMinutes,
          autoGenerateSettings: {
            enabled: true,
            templateType: settings.templateType,
            emotionalCurve: settings.emotionalCurve,
            targetDuration: settings.targetDuration,
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/story-arc/auto-monitor/status', userId] });
      onStatusChange?.(true);
    },
    onError: (error) => {
      console.error('Failed to enable auto monitoring: ', error);
    },
  });

  // Disable monitoring mutation
  const disableMonitoring = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/story-arc/auto-monitor/disable', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId, folderName: 'studio_arc_create' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/story-arc/auto-monitor/status', userId] });
      onStatusChange?.(false);
    },
    onError: (error) => {
      console.error('Failed to disable auto monitoring:', error);
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest('/api/story-arc/auto-monitor/settings', {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          userId,
          folderName: 'studio_arc_create',
          autoGenerateSettings: {
            enabled: true,
            templateType: settings.templateType,
            emotionalCurve: settings.emotionalCurve,
            targetDuration: settings.targetDuration,
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/story-arc/auto-monitor/status', userId] });
      setSettingsOpen(false);
    },
    onError: (error) => {
      console.error('Failed to update auto generation settings:', error);
    },
  });

  // Manual check mutation
  const triggerManualCheck = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/story-arc/auto-monitor/check', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId }),
      });
    },
    onSuccess: () => {
      refetchStatus();
    },
    onError: (error) => {
      console.error('Failed to trigger manual check:', error);
    },
  });

  // Update enabled state based on monitor status
  useEffect(() => {
    if (monitorStatus?.activeMonitors) {
      const isEnabled = monitorStatus.activeMonitors.some(
        monitor => monitor.userId === userId && monitor.monitorFolderName === 'studio_arc_create'
      );
      setMonitorEnabled(isEnabled);

      // Update settings from current monitor config
      if (isEnabled) {
        const currentMonitor = monitorStatus.activeMonitors.find(
          monitor => monitor.userId === userId && monitor.monitorFolderName === 'studio_arc_create'
        );
        if (currentMonitor) {
          setAutoSettings({
            templateType: currentMonitor.autoGenerateSettings.templateType,
            emotionalCurve: currentMonitor.autoGenerateSettings.emotionalCurve,
            targetDuration: currentMonitor.autoGenerateSettings.targetDuration,
            checkIntervalMinutes: currentMonitor.checkIntervalMinutes,
        });
      }
    }
  }
}, [monitorStatus, userId]);

  const handleToggleMonitoring = async () => {
    if (monitorEnabled) {
      disableMonitoring.mutate();
  } else {
      enableMonitoring.mutate(autoSettings);
  }
};

  const handleSaveSettings = () => {
    updateSettings.mutate(autoSettings);
};

  const getProcessingStats = () => {
    if (!monitorStatus?.processedFiles?.studio_arc_create) {
      return { total: 0, processed: 0, failed: 0, pending:  0 };
  }

    const files = monitorStatus.processedFiles.studio_arc_create;
    const total = files.length;
    const processed = files.filter(f => f.processed && !f.processingError).length;
    const failed = files.filter(f => f.processingError).length;
    const pending = files.filter(f => !f.processed && !f.processingError).length;

    return { total, processed, failed, pending };
};

  const stats = getProcessingStats();

  if (isLoadingStatus) {
    return <LinearProgress />;
  }

  return (
    <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack spacing={3}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600} sx={{ color: theming.colors.primary }}>
              📁 Automatisk Story Arc Generering
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={monitorEnabled}
                  onChange={handleToggleMonitoring}
                  disabled={enableMonitoring.isPending || disableMonitoring.isPending}
                />
            }
              label={monitorEnabled ? 'Aktivert' : 'Deaktivert'}
            />
          </Stack>

          {/* Info Alert */}
          <Alert 
            severity="info" 
            icon={theming.getThemedIcon('info')}
            sx={{ '& .MuiAlert-message': { fontSize: 14 } }}
          >
            <Typography variant="body2" fontWeight={500} gutterBottom>
              Automatisk overvåking av Google Drive mappe
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Når du laster opp videoer i mappen <strong>"studio_arc_create"</strong> i din Google Drive, 
              vil systemet automatisk generere en story arc med de innstillingene du har valgt nedenfor.
            </Typography>
          </Alert>

          {/* Folder Status */}
          {monitorEnabled && (
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                    <Folder color="primary" />
                  <Box sx={{ flex:  1 }}>
                    <Typography variant="subtitle2" fontWeight={500}>
                      Overvåket mappe: studio_arc_create
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      CreatorHub Norge Projects/studio_arc_create
                    </Typography>
                  </Box>
                  <Chip 
                    label="Aktiv" 
                    color="success" 
                    size="small" 
                    icon={<CheckCircle fontSize="small"  />}
                  />
                </Stack>

                {/* Statistics */}
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {stats.total}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Totalt prosessert
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {stats.processed}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Vellykket
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {stats.failed}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Feilet
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={3}>
                    <Box textAlign="center">
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {stats.pending}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Venter
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('settings')}
              onClick={() => setSettingsOpen(true)}
              disabled={!monitorEnabled}
            >
              Innstillinger
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('timeline')}
              onClick={() => setHistoryOpen(true)}
              disabled={!monitorEnabled}
            >
              Historikk
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('refresh')}
              onClick={() => triggerManualCheck.mutate()}
              disabled={!monitorEnabled || triggerManualCheck.isPending}
            >
              {triggerManualCheck.isPending ? 'Sjekker...' : 'Sjekk nå'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>

      {/* Settings Dialog */}
      <Dialog 
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Automatisk Generering Innstillinger</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  1 }}>
            <FormControl fullWidth>
              <InputLabel>Template Type</InputLabel>
              <Select
                value={autoSettings.templateType}
                label="Template Type"
                onChange={(e) => setAutoSettings(prev => ({ ...prev, templateType: String(e.target.value) }))}
              >
                <MenuItem value="wedding">Bryllup</MenuItem>
                <MenuItem value="corporate">Bedrift</MenuItem>
                <MenuItem value="music_video">Musikkvideo</MenuItem>
                <MenuItem value="documentary">Dokumentar</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Emosjonell kurve</InputLabel>
              <Select
                value={autoSettings.emotionalCurve}
                label="Emosjonell kurve"
                onChange={(e) => setAutoSettings(prev => ({ ...prev, emotionalCurve: e.target.value }))}
              >
                <MenuItem value="rising">Stigende</MenuItem>
                <MenuItem value="falling">Fallende</MenuItem>
                <MenuItem value="wave">Bølge</MenuItem>
                <MenuItem value="mountain">Fjell</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label="Mål varighet (sekunder)"
              value={autoSettings.targetDuration}
              onChange={(e) => setAutoSettings(prev => ({ ...prev, targetDuration: parseInt(e.target.value, 10) }))}
              inputProps={{ min: 60, max: 3600 }}
              helperText="Standardvarighet for genererte story arcs (480 = 8 minutter)"
            />

            <TextField
              fullWidth
              type="number"
              label="Sjekk intervall (minutter)"
              value={autoSettings.checkIntervalMinutes}
              onChange={(e) => setAutoSettings(prev => ({ ...prev, checkIntervalMinutes: parseInt(e.target.value, 10) }))}
              inputProps={{ min: 1, max: 60 }}
              helperText="Hvor ofte systemet skal sjekke for nye opplastinger"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSaveSettings}
            variant="contained"
            disabled={updateSettings.isPending}
           sx={theming.getThemedButtonSx()}>
            {updateSettings.isPending ? 'Lagrer...' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog 
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Prosesseringshistorikk</DialogTitle>
        <DialogContent>
          {isLoadingHistory ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Filnavn</TableCell>
                    <TableCell>Opplastet</TableCell>
                    <TableCell>Gjenkjent Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Story Arc</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monitorStatus?.processedFiles?.studio_arc_create?.map((file) => (
                    <TableRow key={file.fileId}>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <VideoLibrary fontSize="small" color="primary" />
                          <Typography variant="body2" noWrap>
                            {file.fileName}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {new Date(file.uploadedAt).toLocaleDateString('no-NO')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {file.intelligentSettings ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip 
                              label={file.intelligentSettings.detectedType}
                              size="small"
                              color={file.intelligentSettings.confidence > 0.7 ? 'success' : 
                                     file.intelligentSettings.confidence > 0.3 ? 'warning' : 'default'}
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {(file.intelligentSettings.confidence * 100).toFixed(0)}%
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Ikke analysert
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {file.processingError ? (
                          <Chip 
                            label="Feilet" 
                            color="error" 
                            size="small"
                            icon={<Error fontSize="small" />}
                          />
                        ) : file.processed ? (
                          <Chip 
                            label="Fullført" 
                            color="success" 
                            size="small"
                            icon={<CheckCircle fontSize="small" />}
                          />
                        ) : (
                          <Chip 
                            label="Venter" 
                            color="warning" 
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {file.storyArcId ? (
                          <Typography variant="caption" fontFamily="monospace">
                            {file.storyArcId.slice(-8)}
                          </Typography>
                        ) : (
                         '-')}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Vis detaljer">
                          <IconButton size="small">
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!monitorStatus?.processedFiles?.studio_arc_create || 
                    monitorStatus.processedFiles.studio_arc_create.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Ingen filer prosessert ennå
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>
            Lukk
          </Button>
          <Button onClick={() => refetchHistory()} disabled={isLoadingHistory}>
            Oppdater
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default StoryArcAutoMonitor;