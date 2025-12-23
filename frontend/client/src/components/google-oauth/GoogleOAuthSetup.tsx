import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  CloudDone,
  CheckCircle,
  Error,
  Sync,
  Google,
  FolderShared,
  Email,
  CalendarMonth,
  VideoCall
} from '@mui/icons-material';

interface GoogleOAuthSetupProps {
  compact?: boolean;
}

interface ServiceStatus {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  lastSync?: string
}

const GoogleOAuthSetup: React.FC<GoogleOAuthSetupProps> = ({ compact = false }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Google Drive', icon: <FolderShared />, connected: false },
    { name: 'Gmail', icon: theming.getThemedIcon(', '), connected: false },
    { name: 'Google Calendar', icon: <CalendarMonth />, connected: false },
    { name: 'Google Meet', icon: theming.getThemedIcon(', '), connected: false }
  ]);

  useEffect(() => {
    checkConnectionStatus();
}, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/google-oauth/status');
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data.connected ? 'connected' : 'disconnected');
        
        if (data.connected) {
          setServices(prev => prev.map(service => ({
            ...service,
            connected: true,
            lastSync: new Date().toLocaleString('no-NO')
      })));
      }
    }
  } catch (error) {
      console.error('Error checking OAuth status: ', error);
      setConnectionStatus('error');
  }
};

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Redirect to OAuth flow
      window.location.href = '/api/google-oauth/auth';
  } catch (error) {
      console.error('Error initiating OAuth:', error);
      setConnectionStatus('error');
      setIsConnecting(false);
  }
};

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/google-oauth/disconnect', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST'
  });
      if (response.ok) {
        setConnectionStatus('disconnected');
        setServices(prev => prev.map(service => ({
          ...service,
          connected: false,
          lastSync: undefined
    })));
    }
  } catch (error) {
      console.error('Error disconnecting OAuth:', error);
  }
};

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'error': return 'error';
      default: return 'warning';
}
};

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Tilkoblet';
      case 'error': return 'Feil';
      default: return 'Ikke tilkoblet';
}
};

  if (compact) {
    return (
      <Box sx={{ p:  2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap:  1 }}>
          <Google />
          Google OAuth Status
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Chip
            icon={connectionStatus === 'connected' ? theming.getThemedIcon('checkCircle') : theming.getThemedIcon('error')}
            label={getStatusText()}
            color={getStatusColor() as any}
            size="small"
          />
        </Box>

        {connectionStatus !== 'connected' ? (
          <Button variant="contained"
            startIcon={<Google />}
            onClick={handleConnect}
            disabled={isConnecting}
            size="small"
            fullWidth
          >
            {isConnecting ? 'Kobler til...' : 'Koble til Google'}
          </Button>
        ) : (
          <Button
            variant="outlined"
            onClick={handleDisconnect}
            size="small"
            fullWidth
          >
            Koble fra
          </Button>
        )}
      </Box>
    );
}

  return (
    <Card sx={{ maxWidth: 60, mx: 'auto' ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
          <CloudDone color="primary" />
          Google OAuth Setup
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Koble til Google-tjenestene for å få tilgang til Drive, Gmail, Calendar og Meet integrasjoner.
        </Typography>

        {isConnecting && (
          <Box sx={{ mb:  2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt:  1 }}>
              Kobler til Google...
            </Typography>
          </Box>
        )}

        <Alert severity={getStatusColor() as any} sx={{ mb:  2 }}>
          Status: {getStatusText()}
          {connectionStatus === 'connected' && (
            <Typography variant="body2">
              Alle Google-tjenester er tilkoblet og klare til bruk.
            </Typography>
          )}
        </Alert>

        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Tilgjengelige Tjenester
        </Typography>

        <List>
          {services.map((service, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                {service.icon}
              </ListItemIcon>
              <ListItemText
                primary={service.name}
                secondary={service.connected ? `Sist synkronisert: ${service.lastSync}` : 'Ikke tilkoblet'}
              />
              {service.connected ? (
                <CheckCircle color="success" />
              ) : (
                <Error color="error" />
              )}
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt:  3, display: 'flex', gap:  2 }}>
          {connectionStatus !== 'connected' ? (
            <Button variant="contained"
              startIcon={<Google />}
              onClick={handleConnect}
              disabled={isConnecting}
              fullWidth
            >
              {isConnecting ? 'Kobler til Google...' : 'Koble til Google'}
            </Button>
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={theming.getThemedIcon('sync')}
                onClick={checkConnectionStatus}
                sx={{ flex:  1 }}
              >
                Oppdater Status
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleDisconnect}
                sx={{ flex:  1 }}
              >
                Koble fra
              </Button>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default GoogleOAuthSetup;