/**
 * Batch Processing Panel
 * UI for batch processing multiple audio files
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Alert,
  Collapse
} from '@mui/material';
import {
  PlaylistPlay,
  CheckCircle,
  Error as ErrorIcon,
  Cancel,
  ExpandMore,
  ExpandLess,
  AudioFile
} from '@mui/icons-material';

interface BatchProcessingPanelProps {
  open: boolean;
  onClose: () => void;
  files: string[];
  onComplete: (results: any[]) => void;
}

interface BatchJob {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  results: any[];
  errors: any[];
}

const BatchProcessingPanel: React.FC<BatchProcessingPanelProps> = ({
  open,
  onClose,
  files,
  onComplete
}) => {
  const [jobName, setJobName] = useState('Batch Processing ');
  const [operation, setOperation] = useState<'enhance' | 'restore' | 'mix' | 'normalize'>('enhance');
  const [settings] = useState<any>({});
  const [currentJob, setCurrentJob] = useState<BatchJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState(false);

  // Poll job status
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/batch/job/${currentJob.id}`, {
          credentials: 'include'
        });

        const data = await response.json();

        if (data.success && data.job) {
          setCurrentJob(data.job);

          if (data.job.status === 'completed') {
            onComplete(data.job.results);
          }
        }

      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentJob, onComplete]);

  const handleStartBatch = async () => {
    setError(null);

    try {
      const response = await fetch('/api/batch/create', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: jobName,
          files,
          operation,
          settings
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create batch job');
      }

      setCurrentJob(data.job);

    } catch (err: any) {
      setError(err.message || 'Failed to start batch processing');
    }
  };

  const handleCancel = async () => {
    if (!currentJob) return;

    try {
      await fetch(`/api/batch/cancel/${currentJob.id}`, {
        method: 'POST',
        credentials: 'include'
      });

      setCurrentJob(null);
      onClose();

    } catch (err) {
      console.error('Failed to cancel job: ', err);
    }
  };

  const getStatusColor = (status: BatchJob['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'primary';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: BatchJob['status']) => {
    switch (status) {
      case 'pending': return 'Venter';
      case 'processing': return 'Behandler';
      case 'completed': return 'Fullført';
      case 'failed': return 'Feilet';
      case 'cancelled': return 'Avbrutt';
      default: return status;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PlaylistPlay />
          <Typography variant="h6">Batch-behandling</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {!currentJob ? (
          <>
            {/* Configuration */}
            <TextField
              fullWidth
              label="Jobbnavn"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Operasjon</InputLabel>
              <Select
                value={operation}
                onChange={(e) => setOperation(e.target.value as any)}
                label="Operasjon"
              >
                <MenuItem value="enhance">Forbedre lyd</MenuItem>
                <MenuItem value="restore">Restaurer lyd</MenuItem>
                <MenuItem value="mix">Mikse lyd</MenuItem>
                <MenuItem value="normalize">Normaliser lyd</MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>{files.length} filer</strong> vil bli behandlet med samme innstillinger.
              </Typography>
            </Alert>

            {/* File List */}
            <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 1, p: 1 }}>
              <List dense>
                {files.map((file, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <AudioFile fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.split('/').pop()}
                      secondary={file}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        ) : (
          <>
            {/* Job Progress */}
            <Box sx={{ mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body1">
                  <strong>{currentJob.name}</strong>
                </Typography>
                <Chip
                  label={getStatusLabel(currentJob.status)}
                  color={getStatusColor(currentJob.status)}
                  size="small"
                />
              </Box>

              <LinearProgress
                variant="determinate"
                value={currentJob.progress}
                sx={{ mb: 1 }}
              />

              <Box display="flex" justifyContent="space-between">
                <Typography variant="caption">
                  {currentJob.processedFiles} / {currentJob.totalFiles} filer behandlet
                </Typography>
                <Typography variant="caption">
                  {currentJob.progress}%
                </Typography>
              </Box>
            </Box>

            {/* Statistics */}
            <Box display="flex" gap={1} mb={2}>
              <Chip
                icon={<CheckCircle />}
                label={`${currentJob.processedFiles - currentJob.failedFiles} vellykket`}
                color="success"
                size="small"
              />
              {currentJob.failedFiles > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${currentJob.failedFiles} feilet`}
                  color="error"
                  size="small"
                />
              )}
            </Box>

            {/* Errors */}
            {currentJob.errors.length > 0 && (
              <Box>
                <Button
                  size="small"
                  onClick={() => setExpandedErrors(!expandedErrors)}
                  endIcon={expandedErrors ? <ExpandLess /> : <ExpandMore />}
                >
                  Vis feil ({currentJob.errors.length})
                </Button>
                <Collapse in={expandedErrors}>
                  <List dense>
                    {currentJob.errors.map((err, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <ErrorIcon color="error" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={err.file.split('/').pop()}
                          secondary={err.error}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
            )}

            {/* Completion Message */}
            {currentJob.status === 'completed' && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Batch-behandling fullført! {currentJob.processedFiles - currentJob.failedFiles} av {currentJob.totalFiles} filer ble behandlet.
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        {!currentJob ? (
          <>
            <Button onClick={onClose}>
              Avbryt
            </Button>
            <Button
              onClick={handleStartBatch}
              variant="contained"
              startIcon={<PlaylistPlay />}
              disabled={files.length === 0}
            >
              Start batch-behandling
            </Button>
          </>
        ) : (
          <>
            {currentJob.status === 'processing' && (
              <Button
                onClick={handleCancel}
                startIcon={<Cancel />}
                color="error"
              >
                Avbryt jobb
              </Button>
            )}
            {(currentJob.status === 'completed' || currentJob.status ==='failed') && (
              <Button onClick={onClose} variant="contained">
                Lukk
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BatchProcessingPanel;


