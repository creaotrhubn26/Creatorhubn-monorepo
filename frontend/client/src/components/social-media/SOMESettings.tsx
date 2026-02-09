import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  LinearProgress,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  VpnKey as VpnKeyIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  ContentCopy as ContentCopyIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  YouTube as YouTubeIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface TokenStatus {
  exists: boolean;
  expiresAt: string | null;
  daysUntilExpiration: number | null;
  status: 'valid' | 'expiring_soon' | 'expired' | 'not_configured';
  lastRefreshed: string | null;
}

interface SecretStatus {
  lastRotated: string | null;
  daysSinceRotation: number | null;
  status: 'current' | 'needs_rotation' | 'never_rotated';
  pendingUpdate: boolean;
  pendingSecretPreview: string | null;
}

interface SOMEStatus {
  facebook: {
    token: TokenStatus;
    appSecret: SecretStatus;
    appId: string | null;
    pageId: string | null;
  };
  instagram: {
    userId: string | null;
    configured: boolean;
  };
  tiktok: {
    configured: boolean;
  };
  youtube: {
    configured: boolean;
  };
}

export default function SOMESettings() {
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  const [secretDialog, setSecretDialog] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Fetch SOME settings status
  const { data: status, isLoading } = useQuery<SOMEStatus>({
    queryKey: ['/api/some-settings/status'],
    queryFn: () => apiRequest('/api/some-settings/status,'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch pending secret
  const { data: pendingSecret } = useQuery({
    queryKey: ['/api/some-settings/pending-secret'],
    queryFn: () => apiRequest('/api/some-settings/pending-secret'),
    enabled: status?.facebook.appSecret.pendingUpdate || false,
  });

  // Refresh token mutation
  const refreshToken = useMutation({
    mutationFn: () => apiRequest('/api/some-settings/refresh-token', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/some-settings/status'] });
    },
  });

  // Rotate secret mutation
  const rotateSecret = useMutation({
    mutationFn: () => apiRequest('/api/some-settings/rotate-secret', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/some-settings/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/some-settings/pending-secret'] });
      setSecretDialog(true);
    },
  });

  // Clear pending secret mutation
  const clearPendingSecret = useMutation({
    mutationFn: () =>
      apiRequest('/api/some-settings/pending-secret', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/some-settings/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/some-settings/pending-secret'] });
      setSecretDialog(false);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
      case 'current':
        return 'success';
      case 'expiring_soon':
      case 'needs_rotation':
        return 'warning';
      case 'expired':
      case 'never_rotated':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
      case 'current':
        return <CheckCircleIcon />;
      case 'expiring_soon':
      case 'needs_rotation':
        return <WarningIcon />;
      case 'expired':
      case 'never_rotated':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Valid';
      case 'current':
        return 'Current';
      case 'expiring_soon':
        return 'Expiring Soon';
      case 'needs_rotation':
        return 'Needs Rotation';
      case 'expired':
        return 'Expired';
      case 'never_rotated':
        return 'Never Rotated';
      case 'not_configured':
        return 'Not Configured';
      default:
        return status;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading SOME settings...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary, mb: 3 }}>
        SOME Settings
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Monitor and manage your social media API tokens and credentials. Automatic rotation ensures
        security and prevents service interruptions.
      </Alert>

      {/* Pending Secret Alert */}
      {status?.facebook.appSecret.pendingUpdate && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => setSecretDialog(true)}>
              View Secret
            </Button>
          }
        >
          <Typography variant="subtitle2" fontWeight="bold">
            New App Secret Available
          </Typography>
          <Typography variant="body2">
            A new Facebook App Secret has been generated. Please update your .env file.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Facebook/Instagram Card */}
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <FacebookIcon sx={{ color: '#1877F2', mr: 1 }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Facebook / Instagram
                </Typography>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Access Token Status */}
              <Box mb={3}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Access Token
                  </Typography>
                  <Chip
                    size="small"
                    label={getStatusLabel(status?.facebook.token.status || 'not_configured')}
                    color={getStatusColor(status?.facebook.token.status || 'not_configured')}
                    icon={getStatusIcon(status?.facebook.token.status || 'not_configured')}
                  />
                </Box>

                {status?.facebook.token.exists && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Expires: {status.facebook.token.expiresAt
                        ? new Date(status.facebook.token.expiresAt).toLocaleDateString('no-NO')
                        : 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Days remaining: {status.facebook.token.daysUntilExpiration ?? 'Unknown'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last refreshed:{', '}
                      {status.facebook.token.lastRefreshed
                        ? new Date(status.facebook.token.lastRefreshed).toLocaleDateString('no-NO')
                        : 'Unknown'}
                    </Typography>
                  </>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={refreshToken.isPending ? <CircularProgress size={16} /> : <RefreshIcon />}
                  onClick={() => refreshToken.mutate()}
                  disabled={refreshToken.isPending}
                  sx={{ mt: 1 }}
                >
                  Refresh Token
                </Button>
              </Box>

              {/* App Secret Status */}
              <Box mb={3}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    App Secret
                  </Typography>
                  <Chip
                    size="small"
                    label={getStatusLabel(status?.facebook.appSecret.status || 'never_rotated')}
                    color={getStatusColor(status?.facebook.appSecret.status || 'never_rotated')}
                    icon={getStatusIcon(status?.facebook.appSecret.status || 'never_rotated')}
                  />
                </Box>

                {status?.facebook.appSecret.lastRotated && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Last rotated:{', '}
                      {new Date(status.facebook.appSecret.lastRotated).toLocaleDateString('no-NO')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Days since rotation: {status.facebook.appSecret.daysSinceRotation}
                    </Typography>
                  </>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={rotateSecret.isPending ? <CircularProgress size={16} /> : <SecurityIcon />}
                  onClick={() => rotateSecret.mutate()}
                  disabled={rotateSecret.isPending}
                  sx={{ mt: 1 }}
                >
                  Rotate Secret
                </Button>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Configuration */}
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="App ID"
                    secondary={status?.facebook.appId || 'Not configured'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Page ID"
                    secondary={status?.facebook.pageId || 'Not configured'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <InstagramIcon sx={{ color: '#E4405F' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Instagram User ID"
                    secondary={status?.instagram.userId || 'Not configured'}
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      size="small"
                      label={status?.instagram.configured ? 'Configured' : 'Not configured'}
                      color={status?.instagram.configured ? 'success' : 'default'}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Automation Status Card */}
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ScheduleIcon sx={{ color: theming.colors.primary, mr: 1 }} />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Automation Status
                </Typography>
              </Box>

              <Divider sx={{ mb: 2 }} />

              <List>
                <ListItem>
                  <ListItemIcon>
                    <VpnKeyIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Token Auto-Refresh"
                    secondary="Daily at 3:00 AM - Refreshes when ≤7 days remaining"
                  />
                  <ListItemSecondaryAction>
                    <Chip size="small" label="Active" color="success" icon={<CheckCircleIcon />} />
                  </ListItemSecondaryAction>
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <SecurityIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Secret Auto-Rotation"
                    secondary="Every 90 days for enhanced security"
                  />
                  <ListItemSecondaryAction>
                    <Chip size="small" label="Active" color="success" icon={<CheckCircleIcon />} />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>

              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Next Check:</strong> Tonight at 3:00 AM (Europe/Oslo)
                </Typography>
              </Alert>

              <Box mt={3}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Other Platforms
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <YouTubeIcon sx={{ color: '#FF0000' }} />
                    </ListItemIcon>
                    <ListItemText primary="YouTube" secondary="Channel integration" />
                    <ListItemSecondaryAction>
                      <Chip
                        size="small"
                        label={status?.youtube.configured ? 'Configured' : 'Not configured'}
                        color={status?.youtube.configured ? 'success' : 'default'}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="TikTok" secondary="Pixel tracking" />
                    <ListItemSecondaryAction>
                      <Chip
                        size="small"
                        label={status?.tiktok.configured ? 'Configured' : 'Not configured'}
                        color={status?.tiktok.configured ? 'success' : 'default'}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pending Secret Dialog */}
      <Dialog open={secretDialog} onClose={() => setSecretDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <SecurityIcon sx={{ mr: 1, color: 'warning.main' }} />
            Update Required: New App Secret
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your Facebook App Secret has been rotated. Please update your .env file with the new
            secret below.
          </Alert>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            1. Open your <code>.env</code> file
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            2. Find the line: <code>FACEBOOK_APP_SECRET=...</code>
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            3. Replace with the new secret below:
          </Typography>

          <Box mt={2} mb={2}>
            <TextField
              fullWidth
              label="New App Secret"
              value={pendingSecret?.secret || ', '}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <Tooltip title={copiedSecret ? 'Copied!' : 'Copy to clipboard'}>
                    <IconButton
                      onClick={() => copyToClipboard(pendingSecret?.secret || '')}
                      edge="end"
                    >
                      <ContentCopyIcon color={copiedSecret ? 'success': 'action'} />
                    </IconButton>
                  </Tooltip>
                )}}
            />
          </Box>

          <Alert severity="info">
            <Typography variant="body2">
              After updating your .env file, restart your server for the changes to take effect.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSecretDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => clearPendingSecret.mutate()}
            disabled={clearPendingSecret.isPending}
          >
            I've Updated the .env File
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
