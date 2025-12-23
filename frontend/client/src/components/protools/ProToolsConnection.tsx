/**
 * Pro Tools Connection Component
 * Manages connection status, session selection/creation, and authentication
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  LinearProgress,
  Alert,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  CheckCircle,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  SignalWifi4Bar as SignalWifiStatusbar4,
  SignalWifi3Bar as SignalWifiStatusbar3,
  SignalWifi2Bar as SignalWifiStatusbar2,
  SignalWifi1Bar as SignalWifiStatusbar1,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';

interface ProToolsSession {
  id: string;
  sessionName: string;
  sessionType: 'recording' | 'mixing' | 'mastering' | 'collaboration' | 'remote_session';
  status: 'active' | 'paused' | 'completed' | 'archived' | 'locked';
  lastActivity: string;
  isCollaborative: boolean;
  participants?: any[];
}

interface ProToolsConnectionProps {
  onSessionSelected?: (sessionId: string) => void;
  selectedSessionId?: string;
}

export default function ProToolsConnection({
  onSessionSelected,
  selectedSessionId,
}: ProToolsConnectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'music_producer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  const theming = useTheming(currentProfession);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionType, setNewSessionType] = useState<'recording' | 'mixing' | 'mastering' | 'collaboration' | 'remote_session'>('mixing');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('excellent');

  // Fetch user's Pro Tools sessions
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useQuery({
    queryKey: ['/api/protools/sessions'],
    queryFn: () => apiRequest('/api/protools/sessions'),
    enabled: !!user?.id,
  });

  const sessions: ProToolsSession[] = sessionsData?.data || [];

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionData: { sessionName: string; sessionType: string }) => {
      return apiRequest('/api/protools/sessions', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(sessionData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/protools/sessions'] });
      setShowCreateDialog(false);
      setNewSessionName('');
    },
  });

  // Check connection status
  useEffect(() => {
    if (selectedSessionId) {
      setConnectionStatus('connecting');
      // Simulate connection check - in real implementation, this would check WebSocket connection
      const timer = setTimeout(() => {
        setConnectionStatus('connected');
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setConnectionStatus('disconnected');
    }
  }, [selectedSessionId]);

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    createSessionMutation.mutate({
      sessionName: newSessionName.trim(),
      sessionType: newSessionType,
    });
  };

  const handleSelectSession = (sessionId: string) => {
    onSessionSelected?.(sessionId);
  };

  const getConnectionQualityIcon = () => {
    switch (connectionQuality) {
      case 'excellent':
        return <SignalWifiStatusbar4 sx={{ color: '#4caf50' }} />;
      case 'good':
        return <SignalWifiStatusbar3 sx={{ color: '#8bc34a' }} />;
      case 'fair':
        return <SignalWifiStatusbar2 sx={{ color: '#ff9800' }} />;
      case 'poor':
        return <SignalWifiStatusbar1 sx={{ color: '#f44336' }} />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {professionIcon && (
                <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                  {professionIcon}
                </Box>
              )}
              <Typography variant="h6">
                {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                  ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Pro Tools Connection`
                  : 'Pro Tools Connection'}
              </Typography>
            </Box>
            <Chip
              icon={connectionStatus === 'connected' ? <CheckCircle /> : connectionStatus === 'error' ? <ErrorIcon /> : <LinkOffIcon />}
              label={connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus === 'error' ? 'Error' : 'Disconnected'}
              color={getStatusColor()}
              size="small"
            />
            {connectionStatus === 'connected' && (
              <Tooltip title={`Connection quality: ${connectionQuality}`}>
                {getConnectionQualityIcon()}
              </Tooltip>
            )}
          </Box>
          <Box>
            <IconButton size="small" onClick={() => refetchSessions()} disabled={sessionsLoading}>
              <RefreshIcon />
            </IconButton>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setShowCreateDialog(true)}
              variant="outlined"
            >
              New Session
            </Button>
          </Box>
        </Box>

        {connectionStatus === 'connecting' && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              Connecting to Pro Tools session...
            </Typography>
          </Box>
        )}

        {connectionStatus === 'connected' && selectedSessionId && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Connected to session: {sessions.find(s => s.id === selectedSessionId)?.sessionName || selectedSessionId}
          </Alert>
        )}

        {sessionsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : sessions.length === 0 ? (
          <Alert severity="info">
            No Pro Tools sessions found. Create a new session to get started.
          </Alert>
        ) : (
          <List>
            {sessions.map((session) => (
              <ListItem
                key={session.id}
                button
                selected={selectedSessionId === session.id}
                onClick={() => handleSelectSession(session.id)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.light', '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  }}}
              >
                <ListItemText
                  primary={session.sessionName}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Chip label={session.sessionType} size="small" variant="outlined" />
                      <Chip label={session.status} size="small" color={session.status === 'active' ? 'success' : 'default'} />
                      {session.isCollaborative && (
                        <Chip label={`${session.participants?.length || 0} participants`} size="small" />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {selectedSessionId === session.id && (
                    <CheckCircle color="success" />
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>

      {/* Create Session Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Pro Tools Session</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Session Name"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            margin="normal"
            required
            placeholder="e.g., Song Mix - January 2024"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Session Type</InputLabel>
            <Select
              value={newSessionType}
              onChange={(e) => setNewSessionType(e.target.value as any)}
              label="Session Type"
            >
              <MenuItem value="recording">Recording</MenuItem>
              <MenuItem value="mixing">Mixing</MenuItem>
              <MenuItem value="mastering">Mastering</MenuItem>
              <MenuItem value="collaboration">Collaboration</MenuItem>
              <MenuItem value="remote_session">Remote Session</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateSession}
            variant="contained"
            disabled={!newSessionName.trim() || createSessionMutation.isPending}
          >
            {createSessionMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}





