/**
 * CreatorHub Norge - Advanced Chat Protocols
 * XMPP and Matrix protocol configuration for secure collaboration chat.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
  Chat as XmppIcon,
  Lock,
  Psychology,
  Security as MatrixIcon,
  Send,
} from '@mui/icons-material';

interface XMPPConnection {
  jid: string;
  password: string;
  server: string;
  resource: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity?: string;
}

interface MatrixConnection {
  homeserver: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  status: 'syncing' | 'connected' | 'disconnected' | 'error';
  encryptionEnabled: boolean;
  lastSync?: string;
}

interface ProtocolConfigsResponse {
  xmpp?: Partial<XMPPConnection>;
  matrix?: Partial<MatrixConnection>;
}

interface SendMessagePayload {
  protocol: 'xmpp' | 'matrix';
  to: string;
  body: string;
}

export default function AdvancedChatProtocols() {
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();

  const [currentTab, setCurrentTab] = useState(0);
  const [xmppEnabled, setXmppEnabled] = useState(false);
  const [matrixEnabled, setMatrixEnabled] = useState(false);

  const [xmppConnection, setXmppConnection] = useState<XMPPConnection>({
    jid: '',
    password: '',
    server: 'creatorhub-norge.xmpp.server',
    resource: 'CreatorHub-Web',
    status: 'disconnected',
  });

  const [matrixConnection, setMatrixConnection] = useState<MatrixConnection>({
    homeserver: 'https://matrix.creatorhub-norge.com',
    accessToken: '',
    userId: '',
    deviceId: '',
    status: 'disconnected',
    encryptionEnabled: true,
  });

  const [messageForm, setMessageForm] = useState({ to: '', body: '' });

  const protocolQuery = useQuery<ProtocolConfigsResponse>({
    queryKey: ['/api/chat/protocols'],
    queryFn: async () => {
      const response = await apiRequest('/api/chat/protocols');
      if (!response || typeof response !== 'object') {
        return {};
      }
      return response as ProtocolConfigsResponse;
    },
  });

  useEffect(() => {
    if (!protocolQuery.data) return;

    if (protocolQuery.data.xmpp) {
      setXmppConnection((prev) => ({
        ...prev,
        ...protocolQuery.data.xmpp,
      }));
      if (protocolQuery.data.xmpp.status === 'connected') {
        setXmppEnabled(true);
      }
    }

    if (protocolQuery.data.matrix) {
      setMatrixConnection((prev) => ({
        ...prev,
        ...protocolQuery.data.matrix,
      }));
      if (protocolQuery.data.matrix.status === 'connected') {
        setMatrixEnabled(true);
      }
    }
  }, [protocolQuery.data]);

  const connectXmpp = useMutation({
    mutationFn: async (config: XMPPConnection) =>
      apiRequest('/api/chat/xmpp/connect', {
        method: 'POST',
        body: {
          jid: config.jid,
          password: config.password,
          server: config.server,
          resource: config.resource,
        },
      }),
    onMutate: () => {
      setXmppConnection((prev) => ({ ...prev, status: 'connecting' }));
    },
    onSuccess: (data) => {
      setXmppConnection((prev) => ({
        ...prev,
        ...(typeof data === 'object' && data !== null ? (data as Partial<XMPPConnection>) : {}),
        status: 'connected',
      }));
      setXmppEnabled(true);
      void queryClient.invalidateQueries({ queryKey: ['/api/chat/protocols'] });
    },
    onError: () => {
      setXmppConnection((prev) => ({ ...prev, status: 'error' }));
    },
  });

  const connectMatrix = useMutation({
    mutationFn: async (config: MatrixConnection) =>
      apiRequest('/api/chat/matrix/connect', {
        method: 'POST',
        body: {
          homeserver: config.homeserver,
          accessToken: config.accessToken,
          userId: config.userId,
          deviceId: config.deviceId,
          encryptionEnabled: config.encryptionEnabled,
        },
      }),
    onMutate: () => {
      setMatrixConnection((prev) => ({ ...prev, status: 'syncing' }));
    },
    onSuccess: (data) => {
      setMatrixConnection((prev) => ({
        ...prev,
        ...(typeof data === 'object' && data !== null ? (data as Partial<MatrixConnection>) : {}),
        status: 'connected',
      }));
      setMatrixEnabled(true);
      void queryClient.invalidateQueries({ queryKey: ['/api/chat/protocols'] });
    },
    onError: () => {
      setMatrixConnection((prev) => ({ ...prev, status: 'error' }));
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ protocol, to, body }: SendMessagePayload) =>
      apiRequest(`/api/chat/${protocol}/send`, {
        method: 'POST',
        body: {
          to,
          body,
          messageType: 'text',
        },
      }),
    onSuccess: () => {
      setMessageForm({ to: '', body: '' });
    },
  });

  const selectedProtocol: 'xmpp' | 'matrix' = currentTab === 0 ? 'xmpp' : 'matrix';

  const selectedProtocolConnected = useMemo(() => {
    if (selectedProtocol === 'xmpp') {
      return xmppEnabled && xmppConnection.status === 'connected';
    }
    return matrixEnabled && matrixConnection.status === 'connected';
  }, [selectedProtocol, xmppEnabled, xmppConnection.status, matrixEnabled, matrixConnection.status]);

  const statusColor = (
    status: XMPPConnection['status'] | MatrixConnection['status'],
  ): ChipProps['color'] => {
    if (status === 'connected') return 'success';
    if (status === 'connecting' || status === 'syncing') return 'warning';
    if (status === 'error') return 'error';
    return 'default';
  };

  return (
    <Card sx={{ maxWidth: 1100, mx: 'auto', mt: 2, ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Psychology sx={{ mr: 1, color: '#ff8c00' }} />
          <Typography variant="h5">Avanserte Chat-Protokoller</Typography>
          <Chip label="BETA" size="small" color="secondary" sx={{ ml: 1.5 }} />
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          XMPP og Matrix gir alternativ, sikker og interoperabel chat for samarbeid mellom team,
          klienter og leverandører.
        </Alert>

        <Tabs value={currentTab} onChange={(_, tab: number) => setCurrentTab(tab)} sx={{ mb: 2 }}>
          <Tab icon={<XmppIcon />} label="XMPP" />
          <Tab icon={<MatrixIcon />} label="Matrix" />
        </Tabs>

        {currentTab === 0 && (
          <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">XMPP Protocol</Typography>
              <FormControlLabel
                control={<Switch checked={xmppEnabled} onChange={(e) => setXmppEnabled(e.target.checked)} />}
                label="Aktivér XMPP"
              />
            </Box>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip label={`Status: ${xmppConnection.status}`} color={statusColor(xmppConnection.status)} />
              {xmppConnection.status === 'connected' && (
                <Chip label={xmppConnection.server} size="small" variant="outlined" />
              )}
            </Stack>

            {xmppEnabled && (
              <GridLike>
                <TextField
                  label="JID"
                  value={xmppConnection.jid}
                  onChange={(e) =>
                    setXmppConnection((prev) => ({
                      ...prev,
                      jid: e.target.value,
                    }))
                  }
                  placeholder="bruker@domain.com"
                />
                <TextField
                  label="Passord"
                  type="password"
                  value={xmppConnection.password}
                  onChange={(e) =>
                    setXmppConnection((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
                <Button
                  variant="contained"
                  disabled={connectXmpp.isPending || !xmppConnection.jid || !xmppConnection.password}
                  onClick={() => connectXmpp.mutate(xmppConnection)}
                >
                  {connectXmpp.isPending ? <CircularProgress size={18} /> : 'Koble til XMPP'}
                </Button>
              </GridLike>
            )}
          </Paper>
        )}

        {currentTab === 1 && (
          <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Matrix Protocol</Typography>
              <FormControlLabel
                control={<Switch checked={matrixEnabled} onChange={(e) => setMatrixEnabled(e.target.checked)} />}
                label="Aktivér Matrix"
              />
            </Box>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Chip label={`Status: ${matrixConnection.status}`} color={statusColor(matrixConnection.status)} />
              {matrixConnection.encryptionEnabled && (
                <Chip icon={<Lock />} label="E2E Kryptering" color="success" size="small" />
              )}
            </Stack>

            {matrixEnabled && (
              <GridLike>
                <TextField
                  label="Homeserver"
                  value={matrixConnection.homeserver}
                  onChange={(e) =>
                    setMatrixConnection((prev) => ({
                      ...prev,
                      homeserver: e.target.value,
                    }))
                  }
                  placeholder="https://matrix.org"
                />
                <TextField
                  label="Access Token"
                  type="password"
                  value={matrixConnection.accessToken}
                  onChange={(e) =>
                    setMatrixConnection((prev) => ({
                      ...prev,
                      accessToken: e.target.value,
                    }))
                  }
                />
                <Button
                  variant="contained"
                  color="secondary"
                  disabled={connectMatrix.isPending || !matrixConnection.accessToken}
                  onClick={() => connectMatrix.mutate(matrixConnection)}
                >
                  {connectMatrix.isPending ? <CircularProgress size={18} /> : 'Koble til Matrix'}
                </Button>
              </GridLike>
            )}
          </Paper>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Send testmelding ({selectedProtocol.toUpperCase()})
        </Typography>
        <GridLike>
          <TextField
            label="Til"
            value={messageForm.to}
            onChange={(e) => setMessageForm((prev) => ({ ...prev, to: e.target.value }))}
            placeholder={selectedProtocol === 'xmpp' ? 'bruker@server' : '@bruker:server'}
          />
          <TextField
            label="Melding"
            value={messageForm.body}
            onChange={(e) => setMessageForm((prev) => ({ ...prev, body: e.target.value }))}
          />
          <Button
            variant="contained"
            startIcon={<Send />}
            disabled={
              sendMessage.isPending ||
              !selectedProtocolConnected ||
              !messageForm.to.trim() ||
              !messageForm.body.trim()
            }
            onClick={() =>
              sendMessage.mutate({
                protocol: selectedProtocol,
                to: messageForm.to.trim(),
                body: messageForm.body.trim(),
              })
            }
          >
            {sendMessage.isPending ? 'Sender...' : 'Send'}
          </Button>
        </GridLike>

        {!selectedProtocolConnected && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Koble til valgt protokoll før du kan sende meldinger.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function GridLike({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      sx={{
        '& > *': {
          flex: 1,
        },
      }}
    >
      {children}
    </Stack>
  );
}
