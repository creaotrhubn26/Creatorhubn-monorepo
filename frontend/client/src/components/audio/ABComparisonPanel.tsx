/**
 * A/B Comparison Panel
 * Compare different mix versions side-by-side with synchronized playback
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Paper,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Slider
} from '@mui/material';
import {
  CompareArrows,
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext
} from '@mui/icons-material';

interface ABComparisonPanelProps {
  open: boolean;
  onClose: () => void;
  versions: Array<{
    id: string;
    name: string;
    url: string;
    timestamp: Date;
  }>;
}

const ABComparisonPanel: React.FC<ABComparisonPanelProps> = ({
  open,
  onClose,
  versions
}) => {
  const [selectedA, setSelectedA] = useState(0);
  const [selectedB, setSelectedB] = useState(Math.min(1, Math.max(0, versions.length - 1)));
  const [currentVersion, setCurrentVersion] = useState<'A' | 'B'>('A');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioARef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedA(0);
      setSelectedB(0);
      return;
    }
    if (selectedA >= versions.length) {
      setSelectedA(0);
    }
    if (selectedB >= versions.length) {
      setSelectedB(Math.min(1, versions.length - 1));
    }
  }, [selectedA, selectedB, versions.length]);

  // Sync playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const audio = currentVersion === 'A' ? audioARef.current : audioBRef.current;
      if (audio) {
        setCurrentTime(audio.currentTime);
        setDuration(audio.duration);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, currentVersion]);

  const togglePlayback = () => {
    const audio = currentVersion === 'A' ? audioARef.current : audioBRef.current;
    
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }

    setIsPlaying(!isPlaying);
  };

  const switchVersion = (version: 'A' | 'B') => {
    // Pause current
    if (audioARef.current) audioARef.current.pause();
    if (audioBRef.current) audioBRef.current.pause();

    // Switch
    setCurrentVersion(version);

    // Sync time and play
    const audio = version === 'A' ? audioARef.current : audioBRef.current;
    if (audio) {
      audio.currentTime = currentTime;
      if (isPlaying) {
        audio.play();
      }
    }
  };

  const handleSeek = (value: number) => {
    setCurrentTime(value);
    
    if (audioARef.current) audioARef.current.currentTime = value;
    if (audioBRef.current) audioBRef.current.currentTime = value;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CompareArrows />
          <Typography variant="h6">A/B Sammenligning</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" gap={2} mb={3}>
          {/* Version A */}
          <Paper
            elevation={currentVersion === 'A' ? 6 : 2}
            sx={{
              flex: 1,
              p: 2,
              border: currentVersion === 'A' ? '2px solid #1976d2' : 'none'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Versjon A
            </Typography>
            <ToggleButtonGroup
              value={selectedA}
              exclusive
              onChange={(_, value) => value !== null && setSelectedA(value)}
              orientation="vertical"
              fullWidth
              size="small"
            >
              {versions.map((version, index) => (
                <ToggleButton key={version.id} value={index}>
                  <Box textAlign="left" width="100%">
                    <Typography variant="body2">{version.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(version.timestamp).toLocaleString('no-NO')}
                    </Typography>
                  </Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              fullWidth
              variant={currentVersion === 'A' ? 'contained' : 'outlined'}
              onClick={() => switchVersion('A')}
              sx={{ mt: 2 }}
            >
              Spill A
            </Button>
          </Paper>

          {/* Version B */}
          <Paper
            elevation={currentVersion === 'B' ? 6 : 2}
            sx={{
              flex: 1,
              p: 2,
              border: currentVersion === 'B' ? '2px solid #1976d2' : 'none'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Versjon B
            </Typography>
            <ToggleButtonGroup
              value={selectedB}
              exclusive
              onChange={(_, value) => value !== null && setSelectedB(value)}
              orientation="vertical"
              fullWidth
              size="small"
            >
              {versions.map((version, index) => (
                <ToggleButton key={version.id} value={index}>
                  <Box textAlign="left" width="100%">
                    <Typography variant="body2">{version.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(version.timestamp).toLocaleString('no-NO')}
                    </Typography>
                  </Box>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button
              fullWidth
              variant={currentVersion === 'B' ? 'contained' : 'outlined'}
              onClick={() => switchVersion('B')}
              sx={{ mt: 2 }}
            >
              Spill B
            </Button>
          </Paper>
        </Box>

        {/* Playback Controls */}
        <Paper elevation={2} sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={2}>
            <IconButton onClick={() => handleSeek(Math.max(0, currentTime - 10))}>
              <SkipPrevious />
            </IconButton>
            <IconButton onClick={togglePlayback} color="primary" size="large">
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton onClick={() => handleSeek(Math.min(duration, currentTime + 10))}>
              <SkipNext />
            </IconButton>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="caption">{formatTime(currentTime)}</Typography>
            <Slider
              value={currentTime}
              onChange={(_, value) => handleSeek(value as number)}
              min={0}
              max={duration || 100}
              sx={{ flex: 1 }}
            />
            <Typography variant="caption">{formatTime(duration)}</Typography>
          </Box>

          <Box display="flex" justifyContent="center" mt={2}>
            <Chip
              label={`Spiller nå: Versjon ${currentVersion}`}
              color="primary"
            />
          </Box>
        </Paper>

        {/* Hidden Audio Elements */}
        <audio
          ref={audioARef}
          src={versions[selectedA]?.url}
          style={{ display: 'none' }}
          onEnded={() => setIsPlaying(false)}
        />
        <audio
          ref={audioBRef}
          src={versions[selectedB]?.url}
          style={{ display: 'none' }}
          onEnded={() => setIsPlaying(false)}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ABComparisonPanel;

