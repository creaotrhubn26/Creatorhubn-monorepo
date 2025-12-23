import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('CameraPathRecorder');
import {
  Box,
  Paper,
  Button,
  IconButton,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  LinearProgress,
  Tooltip,
  Divider,
  TextField,
} from '@mui/material';
import {
  FiberManualRecord,
  Stop,
  PlayArrow,
  CloudUpload,
  CloudDone,
  CloudQueue,
  Delete,
  Save,
  Videocam,
  Timeline,
} from '@mui/icons-material';
import { useAnimationStore } from '../../state/animationStore';
import { useVirtualStudio } from '../../../VirtualStudioContext';

// Type for camera node
interface CameraNode {
  id: string;
  type: 'camera';
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
  };
}

interface CameraPathData {
  id: string;
  name: string;
  timestamp: number;
  keyframes: Array<{
    time: number;
    position: [number, number, number];
    rotation: [number, number, number];
    focalLength?: number;
    aperture?: number;
  }>;
  duration: number;
  fps: number;
}

export const CameraPathRecorder: React.FC = () => {
  const {
    addKeyframe,
    isRecording,
    startRecording,
    stopRecording,
    currentTime,
    fps,
    duration,
    tracks,
  } = useAnimationStore();

  const { addToast } = useVirtualStudio();

  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const [captureRate, setCaptureRate] = useState(2); // Capture every N frames
  const [autoSmooth, setAutoSmooth] = useState(true);
  const [pathName, setPathName] = useState('Camera Path');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [savedPaths, setSavedPaths] = useState<CameraPathData[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Active camera from scene state
  const activeCamera: CameraNode = {
    id: 'main-camera',
    type: 'camera',
    transform: {
      position: [0, 1.7, 5],
      rotation: [0, 0, 0],
    },
  };

  const camera = {
    focalLength: 50,
    aperture: 2.8,
  };

  // Start recording camera movement
  const handleStartRecording = useCallback(() => {
    if (!activeCamera) {
      addToast({
        message: 'No camera found in scene',
        type: 'error',
        duration: 3000,
      });
      return;
    }

    startRecording(activeCamera.id);
    setRecordingStartTime(Date.now());
    addToast({
      message: '🎬 Camera recording started',
      type: 'info',
      duration: 2000,
    });

    // Capture camera state at regular intervals
    const interval = setInterval(
      () => {
        const frameTime = Math.floor(
          (Date.now() - (recordingStartTime || Date.now())) / (1000 / fps),
        );

        // Capture position
        addKeyframe({
          time: frameTime,
          nodeId: activeCamera.id,
          property: 'transform.position',
          value: activeCamera.transform.position,
          easing: autoSmooth ? 'easeInOut' : 'linear',
        });

        // Capture rotation
        addKeyframe({
          time: frameTime,
          nodeId: activeCamera.id,
          property: 'transform.rotation',
          value: activeCamera.transform.rotation,
          easing: autoSmooth ? 'easeInOut' : 'linear',
        });

        // Capture camera properties
        if (camera.focalLength) {
          addKeyframe({
            time: frameTime,
            nodeId: activeCamera.id,
            property: 'camera.focalLength',
            value: camera.focalLength,
            easing: autoSmooth ? 'easeInOut' : 'linear',
          });
        }

        if (camera.aperture) {
          addKeyframe({
            time: frameTime,
            nodeId: activeCamera.id,
            property: 'camera.aperture',
            value: camera.aperture,
            easing: autoSmooth ? 'easeInOut' : 'linear',
          });
        }
      },
      (1000 / fps) * captureRate,
    );

    setRecordingInterval(interval);
  }, [activeCamera, startRecording, addKeyframe, captureRate, autoSmooth, fps, recordingStartTime]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }
    stopRecording();
    setRecordingStartTime(null);
    addToast({
      message: '⏹️ Camera recording stopped',
      type: 'success',
      duration: 2000,
    });
  }, [recordingInterval, stopRecording, addToast]);

  // Save camera path to local state
  const handleSavePath = useCallback(() => {
    if (!activeCamera) return;

    // Extract camera keyframes from tracks
    const cameraPositionTrack = tracks.find(
      (t) => t.nodeId === activeCamera.id && t.property === 'transform.position',
    );
    const cameraRotationTrack = tracks.find(
      (t) => t.nodeId === activeCamera.id && t.property === 'transform.rotation',
    );

    if (!cameraPositionTrack && !cameraRotationTrack) {
      addToast({
        message: 'No camera movement recorded',
        type: 'warning',
        duration: 3000,
      });
      return;
    }

    const pathData: CameraPathData = {
      id: `path-${Date.now()}`,
      name: pathName,
      timestamp: Date.now(),
      keyframes: [],
      duration,
      fps,
    };

    // Merge position and rotation keyframes
    const allFrames = new Set<number>();
    cameraPositionTrack?.keyframes.forEach((kf) => allFrames.add(kf.time));
    cameraRotationTrack?.keyframes.forEach((kf) => allFrames.add(kf.time));

    Array.from(allFrames)
      .sort((a, b) => a - b)
      .forEach((time) => {
        const posKf = cameraPositionTrack?.keyframes.find((kf) => kf.time === time);
        const rotKf = cameraRotationTrack?.keyframes.find((kf) => kf.time === time);

        pathData.keyframes.push({
          time,
          position: posKf?.value || [0, 0, 0],
          rotation: rotKf?.value || [0, 0, 0],
        });
      });

    setSavedPaths((prev) => [...prev, pathData]);
    addToast({
      message: `✅ Camera path "${pathName}" saved locally`,
      type: 'success',
      duration: 3000,
      actions: [
        {
          label: 'Sync to Drive',
          action: () => handleSyncToGoogleDrive(),
        },
      ],
    });
  }, [activeCamera, tracks, pathName, duration, fps, addToast]);

  // Sync to Google Drive via server API
  const handleSyncToGoogleDrive = useCallback(async () => {
    if (savedPaths.length === 0) {
      alert('No camera paths to sync');
      return;
    }

    setSyncStatus('syncing');
    setSyncProgress(0);

    try {
      // Upload each camera path to server
      for (let i = 0; i < savedPaths.length; i++) {
        const path = savedPaths[i];
        const fileName = `camera_path_${path.name.replace(/\s+/g, '_')}_${path.timestamp}.json`;
        const fileContent = JSON.stringify(path, null, 2);

        setSyncProgress(((i + 1) / savedPaths.length) * 100);

        // Call server API to upload to Google Drive
        const response = await fetch('/api/virtual-studio/camera-paths', {
          method: 'POST',
          headers: {
            'Content-Type' : 'application/json',
          },
          body: JSON.stringify({
            fileName,
            content: fileContent,
            metadata: {
              name: path.name,
              timestamp: path.timestamp,
              duration: path.duration,
              fps: path.fps,
              keyframeCount: path.keyframes.length,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to sync to Google Drive');
        }
      }

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      log.error('Google Drive sync failed: ', error);
      setSyncStatus('error');
      alert('Failed to sync to Google Drive. Check console for details.');
    }
  }, [savedPaths]);

  // Auto-sync when paths are saved (if enabled)
  const [autoSync, setAutoSync] = useState(false);
  useEffect(() => {
    if (autoSync && savedPaths.length > 0 && syncStatus === 'idle') {
      handleSyncToGoogleDrive();
    }
  }, [autoSync, savedPaths, syncStatus, handleSyncToGoogleDrive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingInterval) {
        clearInterval(recordingInterval);
      }
    };
  }, [recordingInterval]);

  const recordingDuration = recordingStartTime
    ? ((Date.now() - recordingStartTime) / 1000).toFixed(1)
    : '0.0';

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        backgroundColor: '#1a1a1a',
        color: '#fff',
        minWidth: 350}}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Videocam color="primary" />
        <Typography variant="h6">Camera Path Recorder</Typography>
      </Box>

      {!activeCamera && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No camera found in scene. Add a camera to start recording.
        </Alert>
      )}

      {/* Recording Controls */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Recording Controls
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {!isRecording ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<FiberManualRecord />}
              onClick={handleStartRecording}
              disabled={!activeCamera}
              fullWidth
            >
              Start Recording
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Stop />}
              onClick={handleStopRecording}
              fullWidth
            >
              Stop Recording ({recordingDuration}s)
            </Button>
          )}
        </Box>

        {isRecording && (
          <Box sx={{ mb: 2 }}>
            <Chip
              icon={<FiberManualRecord />}
              label={`RECORDING • ${recordingDuration}s`}
              color="error"
              sx={{ animation: 'pulse 1.5s infinite' }}
            />
          </Box>
        )}

        <TextField
          fullWidth
          size="small"
          label="Path Name"
          value={pathName}
          onChange={(e) => setPathName(e.target.value)}
          disabled={isRecording}
          sx={{ mb: 2 }}
        />

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" gutterBottom>
            Capture Rate: Every {captureRate} frames
          </Typography>
          <Slider
            value={captureRate}
            onChange={(_, value) => setCaptureRate(value as number)}
            min={1}
            max={10}
            step={1}
            marks
            disabled={isRecording}
            sx={{ color: '#2196f3' }}
          />
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={autoSmooth}
              onChange={(e) => setAutoSmooth(e.target.checked)}
              disabled={isRecording}
            />
          }
          label="Auto-smooth (Ease In/Out)"
        />
      </Box>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* Save & Sync Controls */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Save & Sync
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Save />}
            onClick={handleSavePath}
            disabled={isRecording || tracks.length === 0}
            fullWidth
          >
            Save Path
          </Button>
          <Button
            variant="outlined"
            startIcon={
              syncStatus === 'idle' ? (
                <CloudUpload />
              ) : syncStatus === 'syncing' ? (
                <CloudQueue />
              ) : syncStatus === 'synced' ? (
                <CloudDone />
              ) : (
                <CloudUpload />
              )
            }
            onClick={handleSyncToGoogleDrive}
            disabled={savedPaths.length === 0 || syncStatus === 'syncing'}
            color={
              syncStatus === 'synced' ? 'success' : syncStatus === 'error' ? 'error' : 'primary'
            }
            fullWidth
          >
            {syncStatus === 'syncing'
              ? 'Syncing...'
              : syncStatus === 'synced'
                ? 'Synced!' : 'Sync to Drive'}
          </Button>
        </Box>

        {syncStatus === 'syncing' && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress variant="determinate" value={syncProgress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Uploading {Math.round(syncProgress)}%
            </Typography>
          </Box>
        )}

        <FormControlLabel
          control={<Switch checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />}
          label="Auto-sync to Google Drive"
        />
      </Box>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* Saved Paths */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Saved Paths ({savedPaths.length})
        </Typography>

        {savedPaths.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No saved paths yet. Record and save a camera path to get started.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
            {savedPaths.map((path) => (
              <Box
                key={path.id}
                sx={{
                  p: 1,
                  mb: 1,
                  backgroundColor: '#222',
                  borderRadius: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems:'center'}}
              >
                <Box>
                  <Typography variant="body2">{path.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {path.keyframes.length} keyframes • {path.duration}s @ {path.fps}fps
                  </Typography>
                </Box>
                <Tooltip title="Delete path">
                  <IconButton
                    size="small"
                    onClick={() => setSavedPaths((prev) => prev.filter((p) => p.id !== path.id))}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Instructions */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="caption">
          <strong>How to use:</strong>
          <br />
          1. Position camera in scene
          <br />
          2. Click "Start Recording"
          <br />
          3. Move camera (orbit, pan, zoom)
          <br />
          4. Click"Stop Recording"
          <br />
          5. Save & sync to Google Drive
        </Typography>
      </Alert>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Paper>
  );
};
