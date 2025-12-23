/**
 * Google Workspace Storage Information Component
 * Viser tydelig oversikt over brukerens Google Workspace lagringsplass
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  Button,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import {
  Storage,
  Refresh,
  CloudQueue,
  FolderOpen,
  Warning,
  Google as GoogleIcon
} from '@mui/icons-material';

interface GoogleWorkspaceStorageData {
  totalStorageGB: number;
  usedStorageGB: number;
  availableStorageGB: number;
  usagePercentage: number;
  storageQuotaType: 'personal' | 'business' | 'enterprise';
  driveUsageGB: number;
  photosUsageGB: number;
  gmailUsageGB: number;
  lastUpdated: string
}

interface GoogleWorkspaceStorageInfoProps {
  userId: string;
  compact?: boolean;
  showDetailsButton?: boolean;
  profession?: string;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

export const GoogleWorkspaceStorageInfo: React.FC<GoogleWorkspaceStorageInfoProps> = ({
  userId,
  compact = false,
  showDetailsButton = true,
  profession: _profession = 'photographer',
  onMeetingCreate: _onMeetingCreate,
  onProjectUpdate: _onProjectUpdate,
  onWorklogCreate: _onWorklogCreate,
  onFileUpload: _onFileUpload,
  onFileDownload: _onFileDownload,
  selectedProject: _selectedProject,
  onProjectSelect: _onProjectSelect
}) => {
  const theme = useTheme();
  const { user: _user } = useAuth();
  const { integration: _integration, communication, dataFlow, componentRegistry, auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('photographer, ');
  const [showDetails, setShowDetails] = useState(false);

  // ✅ REAL API CALL: Hent Google Workspace storage informasjon
  const { data: storageData, isLoading, error, refetch } = useQuery<GoogleWorkspaceStorageData>({
    queryKey: ['/api/google-workspace/storage', userId],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/google-workspace/storage/${userId}`, {
        headers,
      });
    },
    refetchInterval: 5 * 60 * 1000, // Oppdater hver 5. minutt
  });

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'GoogleWorkspaceStorageInfo',
      name: 'Google Workspace Storage Info',
      type: 'universal',
      category: 'google-service',
      capabilities: [
        'storage-monitoring','quota-management','usage-tracking','workspace-integration',
      ],
      dependencies: [],
      props: [],
      events: [],
      dataKeys: ['storage-data','usage-stats','quota-info','workspace-status'],
    });

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'storage-data',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'usage-stats',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'quota-info',
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'workspace-status',
    });

    // Listen for Google Workspace events
    const unsubscribeRefresh = communication.onMessageType(
      'google-workspace: refresh-storage',
      () => {
        refetch();
      },
    );

    const unsubscribeWarning = communication.onMessageType(
      'google-workspace: storage-warning',
      (data: any) => {
        console.log('Storage warning received: ', data);
      },
    );

    return () => {
      componentRegistry.unregisterComponent('GoogleWorkspaceStorageInfo');
      dataFlow.unregisterNode('storage-data');
      dataFlow.unregisterNode('usage-stats');
      dataFlow.unregisterNode('quota-info');
      dataFlow.unregisterNode('workspace-status');
      unsubscribeRefresh();
      unsubscribeWarning();
    };
  }, [userId, componentRegistry, dataFlow, communication, refetch]);

  const formatStorageSize = (sizeGB: number): string => {
    if (sizeGB < 1) {
      return `${Math.round(sizeGB * 1024)} MB`;
    }
    return `${sizeGB.toFixed(1)} GB`;
  };

  const getStorageStatusColor = (percentage: number) => {
    if (percentage < 50) return theme.palette.success.main;
    if (percentage < 80) return theme.palette.warning.main;
    return theme.palette.error.main;
};

  const getStorageStatusText = (percentage: number): string => {
    if (percentage < 50) return 'God lagringsplass';
    if (percentage < 80) return 'Moderat bruk';
    if (percentage < 95) return 'Høy bruk - vurder opprydding';
    return 'Kritisk - lagring nesten full';
};

  if (isLoading) {
    return (
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <GoogleIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Google Workspace Lagring</Typography>
          </Stack>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Henter lagringsinformasjon...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    // Compact error display - less intrusive
    if (compact) {
      return (
        <Card sx={{
          mb: 2,
          borderLeft: `4px solid ${theme.palette.warning.main}`,
          background: alpha(theme.palette.warning.main, 0.05),
          ...theming.getThemedCardSx()
        }}>
          <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Warning sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  Google Workspace utilgjengelig
                </Typography>
              </Stack>
              <Tooltip title="Prøv igjen">
                <IconButton size="small" onClick={() => refetch()}>
                  <Refresh sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>
      );
    }

    // Full error display only in settings
    return (
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Alert 
            severity="warning" 
            action={
              <Button size="small" onClick={() => refetch()}>
                Prøv igjen
              </Button>
          }
          >
            Google Workspace lagringsinformasjon er ikke tilgjengelig
          </Alert>
        </CardContent>
      </Card>
    );
}

  // Mock data hvis ingen ekte data (vil bli erstattet med ekte API)
  const mockStorageData: GoogleWorkspaceStorageData = {
    totalStorageGB: 10,
    usedStorageGB: 35.7,
    availableStorageGB: 64.3,
    usagePercentage: 35.7,
    storageQuotaType: 'business',
    driveUsageGB: 28.4,
    photosUsageGB: 5.8,
    gmailUsageGB: 1.5,
    lastUpdated: new Date().toISOString()
};

  const data = storageData || mockStorageData;

  if (compact) {
    return (
      <Card sx={{
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
        borderLeft: `4px solid ${theme.palette.primary.main}`,
        ...theming.getThemedCardSx()
      }}>
        <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <GoogleIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              <Typography variant="body2" fontWeight="600">
                Google Workspace Lagring
              </Typography>
            </Stack>
            <Chip
              label={`${formatStorageSize(data.usedStorageGB)} / ${formatStorageSize(data.totalStorageGB)}`}
              size="small"
              sx={{
                backgroundColor: alpha(getStorageStatusColor(data.usagePercentage), 0.1),
                color: getStorageStatusColor(data.usagePercentage),
                fontWeight: 60
              }}
            />
          </Stack>

          <LinearProgress
            variant="determinate"
            value={data.usagePercentage}
            sx={{
              mt: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.grey[300], 0.3),
              '& .MuiLinearProgress-bar': {
                backgroundColor: getStorageStatusColor(data.usagePercentage),
                borderRadius: 3
              }
            }}
          />

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {getStorageStatusText(data.usagePercentage)}
            </Typography>
            {showDetailsButton && (
              <Button
                size="small"
                onClick={() => setShowDetails(true)}
                sx={{ fontSize: '0.7rem', minWidth: 'auto', p: 0.5 }}
              >
                Detaljer
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <GoogleIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight="600" sx={{ color: theming.colors.primary }}>
                  Google Workspace Lagring
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Oversikt over din lagringsplass
                </Typography>
              </Box>
            </Stack>
            
            <Stack direction="row" spacing={1}>
              <Tooltip title="Oppdater lagringsinformasjon">
                <IconButton onClick={() => refetch()} size="small">
                  {theming.getThemedIcon('refresh')}
                </IconButton>
              </Tooltip>
              {showDetailsButton && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowDetails(true)}
                  startIcon={theming.getThemedIcon('info')}
                >
                  Detaljer
                </Button>
              )}
            </Stack>
          </Stack>

          <Grid container spacing={3}>
            {/* Hovedlagring */}
            <Grid item xs={12}>
              <Box sx={{ mb:  2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:  1 }}>
                  <Typography variant="body1" fontWeight="600">
                    Total lagring
                  </Typography>
                  <Typography variant="h6" color={getStorageStatusColor(data.usagePercentage)} fontWeight="600" sx={{ color: theming.colors.primary }}>
                    {formatStorageSize(data.usedStorageGB)} / {formatStorageSize(data.totalStorageGB)}
                  </Typography>
                </Stack>
                
                <LinearProgress
                  variant="determinate"
                  value={data.usagePercentage}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: alpha(theme.palette.grey[300], 0.3),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getStorageStatusColor(data.usagePercentage),
                      borderRadius: 6
                    }
                  }}
                />
                
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt:  1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {data.usagePercentage.toFixed(1)}% brukt
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatStorageSize(data.availableStorageGB)} ledig
                  </Typography>
                </Stack>
              </Box>

              <Alert 
                severity={data.usagePercentage > 80 ? "warning" : "info"}
                sx={{ mt:  2 }}
              >
                <Typography variant="body2">
                  <strong>Status: </strong> {getStorageStatusText(data.usagePercentage)}
                  {data.usagePercentage > 90 && (
                    <> - Vi anbefaler å rydde opp i gamle filer eller oppgradere lagringen.</>
                  )}
                </Typography>
              </Alert>
            </Grid>

            {/* Lagringskategorier */}
            <Grid item xs={12}>
              <Typography variant="body1" fontWeight="600" sx={{ mb:  2 }}>
                Fordeling
              </Typography>
              
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FolderOpen sx={{ fontSize:  16, color: theme.palette.info.main }} />
                      <Typography variant="body2">Google Drive</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight="600">
                      {formatStorageSize(data.driveUsageGB)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(data.driveUsageGB / data.totalStorageGB) * 100}
                    sx={{
                      height: 4,
                      mt: 0.5,
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette.info.main
                      }
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Storage sx={{ fontSize:  16, color: theme.palette.warning.main }} />
                      <Typography variant="body2">Google Photos</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight="600">
                      {formatStorageSize(data.photosUsageGB)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(data.photosUsageGB / data.totalStorageGB) * 100}
                    sx={{
                      height: 4,
                      mt: 0.5,
                      backgroundColor: alpha(theme.palette.warning.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette.warning.main
                      }
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CloudQueue sx={{ fontSize:  16, color: theme.palette.secondary.main }} />
                      <Typography variant="body2">Gmail</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight="600">
                      {formatStorageSize(data.gmailUsageGB)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(data.gmailUsageGB / data.totalStorageGB) * 100}
                    sx={{
                      height: 4,
                      mt: 0.5,
                      backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette.secondary.main
                      }
                    }}
                  />
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Detaljer Dialog */}
      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <GoogleIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Google Workspace Lagring - Detaljer</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Konto informasjon</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Konto type: </Typography>
                  <Chip 
                    label={data.storageQuotaType === 'business' ? 'Business' : 'Personal'}
                    size="small"
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Sist oppdatert: </Typography>
                  <Typography variant="body2">
                    {new Date(data.lastUpdated).toLocaleDateString('no-N', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute:'2-digit'
                })}
                  </Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Anbefalinger for {profession}</Typography>
              <Stack spacing={2}>
                {data.usagePercentage > 80 && (
                  <Alert severity="warning">
                    <Typography variant="body2">
                      <strong>Høy lagringsbruk: </strong> Vurder å:
                      <br />• Slette gamle prosjektfiler som ikke lenger trengs
                      <br />• Arkivere fullførte prosjekter til ekstern lagring
                      <br />• Oppgradere til større Google Workspace plan
                    </Typography>
                  </Alert>
                )}

                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Tips for {profession}er: </strong>
                    <br />• Bruk Google Drive automatisk backup fra CreatorHub Norge
                    <br />• Organiser prosjektfiler i strukturerte mapper
                    <br />• Aktiver automatisk sletting av gamle backup-filer
                  </Typography>
                </Alert>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Lukk</Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()} onClick={() => refetch()}>
            Oppdater data
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GoogleWorkspaceStorageInfo;