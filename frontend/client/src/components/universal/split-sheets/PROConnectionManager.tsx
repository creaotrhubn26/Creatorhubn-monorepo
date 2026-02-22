/**
 * PRO Connection Manager
 * Self-service PRO account connection for music producers
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
  Snackbar,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  CheckCircle as ConnectedIcon,
  Link as LinkIcon,
  AccountBalance as PROIcon,
} from '@mui/icons-material';

interface PROConnection {
  id?: string;
  user_id?: string;
  pro_name: 'tono' | 'stim' | 'other';
  pro_account_id?: string | null;
  isrc_prefix?: string | null;
  connection_status: 'pending' | 'connected' | 'disconnected' | 'error';
  last_sync_at?: string | null;
  created_at?: string;
}

interface PROConnectionManagerProps {
  userId: string;
}

export default function PROConnectionManager({
  userId
}: PROConnectionManagerProps) {
  const queryClient = useQueryClient();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedPRO, setSelectedPRO] = useState<'tono' | 'stim' | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<PROConnection | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' }>({ open: false, message: '', severity: 'info' });

  // Fetch connections
  const { data: connectionsData } = useQuery({
    queryKey: ['pro-connections', userId],
    queryFn: async () => {
      const response = await apiRequest('/api/split-sheets/pro-connections');
      return response;
    }
  });

  const connections: PROConnection[] = connectionsData?.data || [];

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await apiRequest(`/api/split-sheets/pro-connections/${connectionId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pro-connections', userId] });
    }
  });

  const handleConnect = (proName: 'tono' | 'stim') => {
    setSelectedPRO(proName);
    setShowConnectDialog(true);
  };

  const _handleOAuthFlow = (proName: 'tono' | 'stim') => {
    // This would initiate OAuth flow
    // For now, show instructions
    setSnackbar({ 
      open: true, 
      message: `For å koble til ${proName.toUpperCase()}: Gå til ${proName === 'tono' ? 'tono.no' : 'stim.se'}, logg inn, autoriser CreatorHub, og kopier tilgangstoken.`,
      severity: 'info'
    });
    
    // In a real implementation, this would:
    // 1. Redirect to PRO OAuth URL
    // 2. Handle callback with authorization code
    // 3. Exchange code for tokens
    // 4. Store encrypted tokens
  };

  const handleDisconnect = (connection: PROConnection) => {
    setConfirmDisconnect(connection);
  };

  const executeDisconnect = () => {
    if (!confirmDisconnect?.id) return;
    disconnectMutation.mutate(confirmDisconnect.id);
    setConfirmDisconnect(null);
  };

  const getPRODisplayName = (proName: string) => {
    switch (proName) {
      case 'tono':
        return 'Tono';
      case 'stim':
        return 'STIM';
      default:
        return proName;
    }
  };

  const _getPROWebsite = (proName: string) => {
    switch (proName) {
      case 'tono':
        return 'https://tono.no';
      case 'stim':
        return 'https://stim.se';
      default:
        return '#';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            PRO-tilkoblinger
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Koble til dine PRO-kontoer (Tono, STIM) for å spore registreringer og ISRC-koder
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Du må logge inn på din PRO-konto og autorisere CreatorHub for å koble til. 
        Vi lagrer ikke passordet ditt, kun sikre tilgangstokens.
      </Alert>

      {/* Available PROs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600}}>
                    Tono
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Norsk Performing Rights Organisation
                  </Typography>
                </Box>
                {connections.find(c => c.pro_name === 'tono' && c.connection_status === 'connected') ? (
                  <Chip
                    icon={<ConnectedIcon />}
                    label="Tilkoblet"
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => handleConnect('tono')}
                  >
                    Koble til
                  </Button>
                )}
              </Stack>
              <Button
                size="small"
                href="https://tono.no"
                target="_blank"
                rel="noopener noreferrer"
              >
                Besøk tono.no →
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600}}>
                    STIM
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Svensk Performing Rights Organisation
                  </Typography>
                </Box>
                {connections.find(c => c.pro_name === 'stim' && c.connection_status === 'connected') ? (
                  <Chip
                    icon={<ConnectedIcon />}
                    label="Tilkoblet"
                    color="success"
                    variant="outlined"
                  />
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => handleConnect('stim')}
                  >
                    Koble til
                  </Button>
                )}
              </Stack>
              <Button
                size="small"
                href="https://stim.se"
                target="_blank"
                rel="noopener noreferrer"
              >
                Besøk stim.se →
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Connected Accounts */}
      {connections.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Tilkoblede kontoer
          </Typography>
          <Stack spacing={2}>
            {connections.map((connection) => (
              <Card key={connection.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <PROIcon sx={{ color: '#9f7aea' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600}}>
                          {getPRODisplayName(connection.pro_name)}
                        </Typography>
                        <Chip
                          label={connection.connection_status === 'connected' ? 'Tilkoblet' : connection.connection_status}
                          size="small"
                          color={connection.connection_status === 'connected' ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </Stack>
                      {connection.pro_account_id && (
                        <Typography variant="body2" color="text.secondary">
                          Konto ID: {connection.pro_account_id}
                        </Typography>
                      )}
                      {connection.isrc_prefix && (
                        <Typography variant="body2" color="text.secondary">
                          ISRC-prefiks: {connection.isrc_prefix}
                        </Typography>
                      )}
                      {connection.last_sync_at && (
                        <Typography variant="caption" color="text.secondary">
                          Sist synkronisert: {new Date(connection.last_sync_at).toLocaleDateString('no-NO')}
                        </Typography>
                      )}
                    </Box>
                    {connection.connection_status === 'connected' && (
                      <IconButton
                        color="error"
                        onClick={() => handleDisconnect(connection)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Connect Dialog */}
      <Dialog
        open={showConnectDialog}
        onClose={() => {
          setShowConnectDialog(false);
          setSelectedPRO(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Koble til {selectedPRO && getPRODisplayName(selectedPRO)}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            OAuth-integrasjon er under utvikling. For nå må du manuelt legge til tilgangstoken.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            1. Gå til {selectedPRO === 'tono' ? 'tono.no' : 'stim.se'} og logg inn
            <br />
            2. Gå til API/Developer-innstillinger
            <br />
            3. Opprett en OAuth-applikasjon
            <br />
            4. Kopier Access Token og Refresh Token
            <br />
            5. Lim inn tokenene nedenfor
          </Typography>
          <TextField
            label="Access Token"
            fullWidth
            sx={{ mb: 2 }}
            placeholder="Lim inn access token her"
          />
          <TextField
            label="Refresh Token"
            fullWidth
            sx={{ mb: 2 }}
            placeholder="Lim inn refresh token her"
          />
          <TextField
            label="PRO Account ID (valgfritt)"
            fullWidth
            sx={{ mb: 2 }}
            placeholder="Din PRO-konto ID"
          />
          <TextField
            label="ISRC Prefix (valgfritt)"
            fullWidth
            placeholder="f.eks. NO-ABC-12"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowConnectDialog(false);
            setSelectedPRO(null);
          }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              // This would save the connection
              alert('OAuth-integrasjon vil bli fullført i neste fase');
              setShowConnectDialog(false);
              setSelectedPRO(null);
            }}
            sx={{ bgcolor: '#9f7aea' }}
          >
            Koble til
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Disconnect Dialog */}
      <Dialog open={!!confirmDisconnect} onClose={() => setConfirmDisconnect(null)}>
        <DialogTitle>Bekreft frakobling</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil koble fra {confirmDisconnect?.pro_name.toUpperCase()}? Du kan koble til igjen senere.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDisconnect(null)}>Avbryt</Button>
          <Button onClick={executeDisconnect} color="error" variant="contained">Koble fra</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}























