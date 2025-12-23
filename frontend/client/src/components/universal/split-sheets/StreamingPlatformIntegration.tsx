/**
 * Streaming Platform Integration
 * Connect to streaming platforms for automatic revenue import
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  CheckCircle as ConnectedIcon,
  MusicNote as SpotifyIcon,
  Apple as AppleIcon,
  YouTube as YouTubeIcon,
  MusicNote
} from '@mui/icons-material';

interface StreamingConnection {
  id?: string;
  platform: 'spotify' | 'apple_music' | 'youtube_music' | 'other';
  access_token?: string;
  refresh_token?: string;
  account_id?: string;
  connection_status: 'connected' | 'disconnected' | 'error';
  last_sync_at?: string | null;
}

interface StreamingPlatformIntegrationProps {
  splitSheetId?: string;
  onRevenueImported?: (revenue: any[]) => void;
}

export default function StreamingPlatformIntegration({
  splitSheetId,
  onRevenueImported
}: StreamingPlatformIntegrationProps) {
  const queryClient = useQueryClient();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // In a real implementation, this would fetch from an API
  const connections: StreamingConnection[] = [];

  const handleConnect = (platform: string) => {
    setSelectedPlatform(platform);
    setShowConnectDialog(true);
  };

  const handleSync = async (platform: string) => {
    setIsSyncing(true);
    try {
      // This would call the streaming platform API
      // For now, just simulate
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(`Synkronisering med ${platform} fullført. Inntekt vil bli importert automatisk.`);
    } catch (error) {
      console.error('Error syncing: ', error);
      alert('Feil ved synkronisering');
    } finally {
      setIsSyncing(false);
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'spotify':
        return 'Spotify';
      case 'apple_music':
        return 'Apple Music';
      case 'youtube_music':
        return 'YouTube Music';
      default:
        return platform;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'spotify':
        return <SpotifyIcon />;
      case 'apple_music':
        return <AppleIcon />;
      case 'youtube_music':
        return <YouTubeIcon />;
      default:
        return <MusicNote />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 70, mb: 0.5 }}>
            Streaming-plattform integrasjon
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Koble til streaming-tjenester for automatisk import av inntekt
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Ved å koble til streaming-plattformer kan vi automatisk importere inntektsdata 
        og beregne betalinger basert på split sheet-prosentandeler.
      </Alert>

      {/* Available Platforms */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {['spotify', 'apple_music', 'youtube_music'].map((platform) => {
          const connection = connections.find(c => c.platform === platform);
          const isConnected = connection?.connection_status === 'connected';

          return (
            <Grid item xs={12} md={4} key={platform}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {getPlatformIcon(platform)}
                      <Typography variant="h6" sx={{ fontWeight: 600}}>
                        {getPlatformName(platform)}
                      </Typography>
                    </Stack>
                    {isConnected ? (
                      <Chip
                        icon={<ConnectedIcon />}
                        label="Tilkoblet"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => handleConnect(platform)}
                      >
                        Koble til
                      </Button>
                    )}
                  </Stack>
                  {isConnected && (
                    <Stack spacing={1}>
                      {connection?.last_sync_at && (
                        <Typography variant="caption" color="text.secondary">
                          Sist synkronisert: {new Date(connection.last_sync_at).toLocaleDateString('no-NO')}
                        </Typography>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<SyncIcon />}
                        onClick={() => handleSync(platform)}
                        disabled={isSyncing}
                        fullWidth
                      >
                        {isSyncing ? 'Synkroniserer...' : 'Synkroniser nå'}
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Connection Instructions */}
      {connections.length === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Hvordan koble til
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="1. Opprett en Developer-konto"
                  secondary="Gå til utviklerportalen for den valgte plattformen"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="2. Opprett en applikasjon"
                  secondary="Registrer CreatorHub som en applikasjon i utviklerportalen"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="3. Autoriser tilgang"
                  secondary="Gi CreatorHub tilgang til å lese inntektsdata"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="4. Automatisk import"
                  secondary="Inntekt vil bli importert automatisk hver uke"
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      )}

      {/* Connect Dialog */}
      <Dialog
        open={showConnectDialog}
        onClose={() => {
          setShowConnectDialog(false);
          setSelectedPlatform(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Koble til {selectedPlatform && getPlatformName(selectedPlatform)}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Streaming-plattform integrasjon krever OAuth-autentisering. 
            Dette vil bli implementert med full OAuth-flow i produksjon.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            For å koble til {selectedPlatform}:
            <br />
            1. Gå til utviklerportalen for {selectedPlatform}
            <br />
            2. Opprett en OAuth-applikasjon
            <br />
            3. Kopier Client ID og Client Secret
            <br />
            4. Autoriser CreatorHub til å få tilgang
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowConnectDialog(false);
            setSelectedPlatform(null);
          }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              alert('OAuth-integrasjon vil bli implementert i neste fase');
              setShowConnectDialog(false);
              setSelectedPlatform(null);
            }}
            sx={{ bgcolor: '#9f7aea' }}
          >
            Start OAuth-flow
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}























