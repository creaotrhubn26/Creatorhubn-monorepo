/**
 * CreatorHub Norge - Advanced Chat Protocols
 * XMPP og Matrix Protocol implementasjon for alternative messaging
 * ⚠️ CHAT & COMMUNICATION PROTOKOLL: Følger CreatorHub Norge protokoller
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Paper,
  Divider
} from '@mui/material';
import {
  Chat as ClosemppIcon,
  Security as MatrixIcon,
  Send,
  Settings,
  People,
  Lock,
  Verified,
  Error,
  CheckCircle,
  Info,
  Refresh,
  Add,
  PersonAdd,
  VpnKey,
  Security
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface XMPPConnection {
  jid: string;
  password: string;
  server: string;
  resource: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity?: string
}

interface MatrixConnection {
  homeserver: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  status: 'syncing' | 'connected' | 'disconnected' | 'error';
  encryptionEnabled: boolean;
  lastSync?: string
}

interface ChatMessage {
  id: string;
  protocol: 'xmpp' | 'matrix' | 'websocket';
  from: string;
  to: string;
  body: string;
  timestamp: string;
  encrypted: boolean;
  messageType: 'text' | 'file' | 'image'
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`chat-protocol-tabpanel-${index}`}
      aria-labelledby={`chat-protocol-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

export default function AdvancedChatProtocols() {
  const [currentTab, setCurrentTab] = useState(0);
  const [xmppEnabled, setXmppEnabled] = useState(false);
  const [matrixEnabled, setMatrixEnabled] = useState(false);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupType, setSetupType] = useState<'xmpp' | 'matrix'>('xmpp');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // ⚠️ XMPP Connection State
  const [xmppConnection, setXmppConnection] = useState<XMPPConnection>({
    jid: '',
    password: '',
    server: 'creatorhub-norge.xmpp.server',
    resource: 'CreatorHub-Web',
    status: 'disconnected'
});

  // ⚠️ Matrix Connection State  
  const [matrixConnection, setMatrixConnection] = useState<MatrixConnection>({
    homeserver: 'https://matrix.creatorhub-norge.com',
    accessToken: '',
    userId: '',
    deviceId: ', ',
    status: 'disconnected',
    encryptionEnabled: true
});

  // Fetch existing protocol configurations
  const { data: protocolConfigs, isLoading } = useQuery({
    queryKey: ['/api/chat/protocols', ],
    queryFn: () => apiRequest('/api/chat/protocols')
});

  // Initialize XMPP connection
  const initXmppConnection = useMutation({
    mutationFn: async (config: Partial<XMPPConnection>) => {
      return apiRequest('/api/chat/xmpp/connect', {
        method: 'POS',
        body: JSON.stringify(config)
  });
  },
    onSuccess: (data) => {
      setXmppConnection(prev => ({ ...prev, status: 'connected', ...data }));
      setXmppEnabled(true);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/protocols', ],});
  },
    onError: () => {
      setXmppConnection(prev => ({ ...prev, status: 'error',}));
  }
});

  // Initialize Matrix connection
  const initMatrixConnection = useMutation({
    mutationFn: async (config: Partial<MatrixConnection>) => {
      return apiRequest('/api/chat/matrix/connect', {
        method: 'POS',
        body: JSON.stringify(config)
  });
  },
    onSuccess: (data) => {
      setMatrixConnection(prev => ({ ...prev, status: 'connected', ...data }));
      setMatrixEnabled(true);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/protocols', ],});
  },
    onError: () => {
      setMatrixConnection(prev => ({ ...prev, status: 'error',}));
  }
});

  // Send message through selected protocol
  const sendMessage = useMutation({
    mutationFn: async ({ protocol, to, body }: { protocol: 'xmpp' | 'matrix'; to: string; body: string }) => {
      return apiRequest(`/api/chat/${protocol}/send`, {
        method: 'POS',
        body: JSON.stringify({ , tobody, messageType: 'text',})
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', ],});
  }
});

  const getProtocolStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'connecting': 
      case 'syncing': return 'warning';
      case 'error': return 'error';
      default: return 'default';
}
};

  const getProtocolStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return theming.getThemedIcon(',');
      case 'connecting':
      case 'syncing': return <CircularProgress size={20} />;
      case 'error': return theming.getThemedIcon('error');
      default: return theming.getThemedIcon(', ');
  }
};

  return (
    <Card sx={{ maxWidth: 80, mx: 'auto', mt:  2 ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
          <Security sx={{ mr: 2, color: '#ff8c00'}} />
          <Typography variant="h5" component="h2" sx={{ color: theming.colors.primary }}>
            Avanserte Chat-Protokoller
          </Typography>
          <Chip 
            label="BETA" 
            size="small" 
            color="secondary" 
            sx={{ ml:  2 }}
          />
        </Box>

        <Alert severity="info" sx={{ mb:  3 }}>
          <strong>XMPP og Matrix Protocol: </strong> Alternative chat-løsninger for økt sikkerhet og interoperabilitet. 
          XMPP er en åpen standard for sanntids-messaging, mens Matrix tilbyr kryptert, decentralisert kommunikasjon.
        </Alert>

        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)} sx={{ mb:  3 }}>
          <Tab 
            icon={<XmppIcon />} 
            label="XMPP Protocol" 
            id="chat-protocol-tab-0"
            aria-controls="chat-protocol-tabpanel-0"
          />
          <Tab 
            icon={<MatrixIcon />} 
            label="Matrix Protocol" 
            id="chat-protocol-tab-1"
            aria-controls="chat-protocol-tabpanel-1"
          />
        </Tabs>

        {/* XMPP Protocol Panel */}
        <TabPanel value={currentTab} index={0}>
          <Box sx={{ mb:  3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>XMPP (Extensible Messaging and Presence Protocol)</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={xmppEnabled}
                    onChange={(e) => setXmppEnabled(e.target.checked)}
                    disabled={initXmppConnection.isPending}
                  />
              }
                label="Aktivér XMPP"
              />
            </Box>

            <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(25, 1400.1)' ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                <Chip 
                  icon={getProtocolStatusIcon(xmppConnection.status)}
                  label={`Status: ${xmppConnection.status.toUpperCase()}`}
                  color={getProtocolStatusColor(xmppConnection.status) as any}
                  sx={{ mr:  2 }}
                />
                {xmppConnection.status === 'connected' && (
                  <Typography variant="body2" color="text.secondary">
                    Koblet til: {xmppConnection.server}
                  </Typography>
                )}
              </Box>

              {xmppEnabled && xmppConnection.status === 'disconnected' && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    label="JID (Jabber ID)"
                    value={xmppConnection.jid}
                    onChange={(e) => setXmppConnection(prev => ({ ...prev, jid: e.target.value }))}
                    placeholder="bruker@domain.com"
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Passord"
                    type="password"
                    value={xmppConnection.password}
                    onChange={(e) => setXmppConnection(prev => ({ ...prev, password: e.target.value }))}
                    size="small"
                    fullWidth
                  />
                  <Button variant="contained"
                    onClick={() => initXmppConnection.mutate(xmppConnection)}
                    disabled={initXmppConnection.isPending || !xmppConnection.jid || !xmppConnection.password}
                    sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67c00',} }}
                  >
                    Koble til
                  </Button>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary">
                <strong>Funksjoner: </strong> Åpen standard, bredt støttet, presence-informasjon, multi-user chat (MUC)
              </Typography>
            </Paper>

            {xmppEnabled && xmppConnection.status === 'connected' && (
              <Box>
                <Typography variant="h6" sx={{  mb:  2  }}>XMPP Kontakter</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: '#ff8c00'}}>
                        {theming.getThemedIcon('people')}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary="CreatorHub Support"
                      secondary="support@creatorhub-norge.xmpp.server"
                    />
                    <Chip label="Online" color="success" size="small" />
                  </ListItem>
                </List>
              </Box>
            )}
          </Box>
        </TabPanel>

        {/* Matrix Protocol Panel */}
        <TabPanel value={currentTab} index={1}>
          <Box sx={{ mb:  3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Matrix Protocol</Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={matrixEnabled}
                    onChange={(e) => setMatrixEnabled(e.target.checked)}
                    disabled={initMatrixConnection.isPending}
                  />
              }
                label="Aktivér Matrix"
              />
            </Box>

            <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(16, 39, 176, 0.1)' ,  ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                <Chip 
                  icon={getProtocolStatusIcon(matrixConnection.status)}
                  label={`Status: ${matrixConnection.status.toUpperCase()}`}
                  color={getProtocolStatusColor(matrixConnection.status) as any}
                  sx={{ mr:  2 }}
                />
                {matrixConnection.encryptionEnabled && (
                  <Chip 
                    icon={theming.getThemedIcon('lock')}}
                    label="End-to-End Kryptert"
                    color="success"
                    size="small"
                    sx={{ mr:  2 }}
                  />
                )}
                {matrixConnection.status === 'connected' && (
                  <Typography variant="body2" color="text.secondary">
                    Bruker-ID: {matrixConnection.userd}
                  </Typography>
                )}
              </Box>

              {matrixEnabled && matrixConnection.status === 'disconnected' && (
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    label="Homeserver"
                    value={matrixConnection.homeserver}
                    onChange={(e) => setMatrixConnection(prev => ({ ...prev, homeserver: e.target.value }))}
                    placeholder="https: //matrix.org"
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Access Token"
                    type="password"
                    value={matrixConnection.accessToken}
                    onChange={(e) => setMatrixConnection(prev => ({ ...prev, accessToken: e.target.value }))}
                    size="small"
                    fullWidth
                  />
                  <Button variant="contained"
                    onClick={() => initMatrixConnection.mutate(matrixConnection)}
                    disabled={initMatrixConnection.isPending || !matrixConnection.accessToken}
                    sx={{ bgcolor: '#9c27b0', '&:hover': { bgcolor: '#7b1fa2',} }}
                  >
                    Koble til
                  </Button>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary">
                <strong>Funksjoner: </strong> End-to-end kryptering, decentralisert, federation, rich media support
              </Typography>
            </Paper>

            {matrixEnabled && matrixConnection.status === 'connected' && (
              <Box>
                <Typography variant="h6" sx={{  mb:  2  }}>Matrix Rom</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: '#9c27b0'}}>
                        {theming.getThemedIcon('lock')}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary="#creatorhub-norge: matrix.org"
                      secondary="Hovedrom for CreatorHub Norge brukere"
                    />
                    <Chip label="Kryptert" color="success" size="small" />
                  </ListItem>
                </List>
              </Box>
           )}
          </Box>
        </TabPanel>

        {/* Protocol Comparison */}
        <Divider sx={{ my:  3 }} />
        <Typography variant="h6" sx={{  mb:  2  }}>Protokoll Sammenligning</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap:  2 }}>
          <Paper sx={{ p: 2, border: '2px solid #ff8c00',  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
              <XmppIcon sx={{ mr: 1, color: '#ff8c00'}} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>XMPP</Typography>
            </Box>
            <Typography variant="body2" sx={{ mb:  1 }}>✅ Åpen standard siden 1999</Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>✅ Lav ressursbruk</Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>✅ Bred software-støtte</Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>⚠️ Basis kryptering</Typography>
          </Paper>
          
          <Paper sx={{ p: 2, border: '2px solid #9c27b0',  ...theming.getThemedCardSx() }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
              <MatrixIcon sx={{ mr: 1, color: '#9c27b0'}} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Matrix</Typography>
            </Box>
            <Typography variant="body2" sx={{ mb:  1 }}>✅ End-to-end kryptering</Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>✅ Decentralisert arkitektur</Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>✅ Rich media støtte</Typography>
            <Typography variant="body2" sx={{ mb:  1 }}>⚠️ Høyere ressursbruk</Typography>
          </Paper>
        </Box>
      </CardContent>
    </Card>
  );
}