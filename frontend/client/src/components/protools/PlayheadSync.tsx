/**
 * Playhead Sync Component
 * Bidirectional playhead synchronization between Pro Tools and web app
 * Displays current playhead position, sync controls, and timecode
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Switch,
  FormControlLabel,
  Chip,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Sync,
  SyncDisabled,
  ArrowUpward,
  ArrowDownward,
  Refresh,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';

interface PlayheadSyncProps {
  sessionId: string;
  currentTime?: number; // Current time in seconds (from web app)
  duration?: number; // Total duration in seconds
  onTimeChange?: (time: number) => void; // Callback when time changes in web app
}

interface PlayheadState {
  timecode: string;
  transportPosition: number;
  isPlaying: boolean;
  lastUpdate: number;
}

export default function PlayheadSync({
  sessionId,
  currentTime = 0,
  duration = 0,
  onTimeChange,
}: PlayheadSyncProps) {
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
  
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncDirection, setSyncDirection] = useState<'bidirectional' | 'protools_to_web' | 'web_to_protools'>('bidirectional');
  const [playheadState, setPlayheadState] = useState<PlayheadState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current playhead state
  const { data: playheadData, refetch: refetchPlayhead } = useQuery({
    queryKey: ['/api/protools/sessions', sessionId, 'playhead'],
    queryFn: () => apiRequest(`/api/protools/sessions/${sessionId}/playhead`),
    enabled: !!sessionId && syncEnabled,
    refetchInterval: syncEnabled ? 1000 : false,
  });

  // Update playhead mutation
  const updatePlayheadMutation = useMutation({
    mutationFn: async (data: { timecode?: string; transportPosition?: number; isPlaying?: boolean }) => {
      return apiRequest(`/api/protools/sessions/${sessionId}/playhead`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
    },
  });

  // Convert seconds to SMPTE timecode
  const secondsToTimecode = useCallback((seconds: number, fps: number = 30): string => {
    const totalFrames = Math.floor(seconds * fps);
    const hours = Math.floor(totalFrames / (fps * 3600));
    const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
    const secs = Math.floor((totalFrames % (fps * 60)) / fps);
    const frames = totalFrames % fps;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}:${frames.toString().padStart(2,'0')}`;
  }, []);

  // Convert SMPTE timecode to seconds
  const timecodeToSeconds = useCallback((timecode: string): number => {
    const parts = timecode.split(':');
    if (parts.length !== 4) return 0;
    const [hours, minutes, seconds, frames] = parts.map(Number);
    const fps = 30;
    return hours * 3600 + minutes * 60 + seconds + frames / fps;
  }, []);

  // Format time for display
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!sessionId || !syncEnabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/protools/${sessionId}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('🎵 Pro Tools WebSocket connected');
          setIsConnected(true);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'playhead_update') {
              const { timecode, transportPosition, isPlaying } = message.data || {};
              setPlayheadState({
                timecode: timecode || ', ',
                transportPosition: transportPosition || 0,
                isPlaying: isPlaying || false,
                lastUpdate: Date.now(),
              });

              // Update web app playhead if sync direction allows
              if (syncDirection === 'bidirectional' || syncDirection === 'protools_to_web') {
                if (transportPosition !== undefined && onTimeChange) {
                  onTimeChange(transportPosition);
                }
              }
            } else if (message.type === 'connected') {
              setIsConnected(true);
            } else if (message.type === 'pong') {
              // Keep-alive response
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('🎵 Pro Tools WebSocket disconnected');
          setIsConnected(false);
          
          // Attempt to reconnect after 3 seconds
          if (syncEnabled) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, 3000);
          }
        };

        ws.onerror = (error) => {
          console.error('🎵 Pro Tools WebSocket error:', error);
          setIsConnected(false);
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [sessionId, syncEnabled, syncDirection, onTimeChange]);

  // Send playhead update to Pro Tools
  const sendPlayheadUpdate = useCallback((time: number, isPlaying: boolean = false) => {
    if (!syncEnabled || !sessionId) return;
    
    if (syncDirection === 'bidirectional' || syncDirection === 'web_to_protools') {
      const timecode = secondsToTimecode(time);
      updatePlayheadMutation.mutate({
        timecode,
        transportPosition: time,
        isPlaying,
      });

      // Also send via WebSocket for real-time sync
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'playhead_update',
          sessionId,
          data: {
            timecode,
            transportPosition: time,
            isPlaying,
          },
        }));
      }
    }
  }, [syncEnabled, syncDirection, sessionId, secondsToTimecode, updatePlayheadMutation]);

  // Handle web app time changes
  useEffect(() => {
    if (currentTime !== undefined && syncEnabled) {
      sendPlayheadUpdate(currentTime, false);
    }
  }, [currentTime, sendPlayheadUpdate, syncEnabled]);

  const handlePlay = () => {
    const time = playheadState?.transportPosition || currentTime || 0;
    sendPlayheadUpdate(time, true);
  };

  const handlePause = () => {
    const time = playheadState?.transportPosition || currentTime || 0;
    sendPlayheadUpdate(time, false);
  };

  const handleStop = () => {
    sendPlayheadUpdate(0, false);
    if (onTimeChange) {
      onTimeChange(0);
    }
  };

  const displayTime = playheadState?.transportPosition ?? currentTime;
  const displayTimecode = playheadState?.timecode || secondsToTimecode(displayTime);
  const isPlaying = playheadState?.isPlaying || false;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {professionIcon && (
              <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
                {professionIcon}
              </Box>
            )}
            <Typography variant="h6">
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Playhead Sync`
                : 'Playhead Sync'}
            </Typography>
            <Chip
              icon={isConnected ? <Sync /> : <SyncDisabled />}
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'default'}
              size="small"
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                color="primary"
              />
            }
            label="Sync Enabled"
          />
        </Box>

        {syncEnabled && (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Sync Direction</InputLabel>
              <Select
                value={syncDirection}
                onChange={(e) => setSyncDirection(e.target.value as any)}
                label="Sync Direction"
              >
                <MenuItem value="bidirectional">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Sync /> Bidirectional
                  </Box>
                </MenuItem>
                <MenuItem value="protools_to_web">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ArrowDownward /> Pro Tools → Web
                  </Box>
                </MenuItem>
                <MenuItem value="web_to_protools">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ArrowUpward /> Web → Pro Tools
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>

            {/* Timecode Display */}
            <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Current Position
              </Typography>
              <Typography variant="h5" sx={{ fontFamily: 'monospace', mb: 0.5 }}>
                {displayTimecode}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatTime(displayTime)} / {formatTime(duration)}
              </Typography>
            </Box>

            {/* Progress Bar */}
            {duration > 0 && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={(displayTime / duration) * 100}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
            )}

            {/* Transport Controls */}
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Tooltip title="Play">
                <IconButton onClick={handlePlay} color="primary" disabled={!isConnected}>
                  <PlayArrow />
                </IconButton>
              </Tooltip>
              <Tooltip title="Pause">
                <IconButton onClick={handlePause} color="primary" disabled={!isConnected}>
                  <Pause />
                </IconButton>
              </Tooltip>
              <Tooltip title="Stop">
                <IconButton onClick={handleStop} color="primary" disabled={!isConnected}>
                  <Stop />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton onClick={() => refetchPlayhead()} disabled={!isConnected}>
                  <Refresh />
                </IconButton>
              </Tooltip>
            </Box>

            {isPlaying && (
              <Chip
                label="Playing"
                color="success"
                size="small"
                sx={{ mt: 2, display: 'block', textAlign:'center' }}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}























