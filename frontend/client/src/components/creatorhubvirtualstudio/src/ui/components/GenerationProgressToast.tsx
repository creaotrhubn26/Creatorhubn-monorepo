import * as React from 'react';
import {
  Paper,
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Collapse,
  Tooltip,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import MaximizeIcon from '@mui/icons-material/Maximize';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

interface GenerationProgressToastProps {
  taskId: string;
  prompt: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  onCancel: () => void;
  onComplete?: (modelUrl: string) => void;
}

export default function GenerationProgressToast({
  taskId,
  prompt,
  progress,
  status,
  error,
  onCancel,
  onComplete,
}: GenerationProgressToastProps) {
  const [minimized, setMinimized] = React.useState(false);
  const [visible, setVisible] = React.useState(true);

  // Auto-dismiss after 3 seconds on completion
  React.useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onCancel, 300); // Wait for fade out animation
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, onCancel]);

  if (!visible) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'failed':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      default:
        return <SmartToyIcon color="primary" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Venter...';
      case 'processing':
        return 'Behandler...';
      case 'completed':
        return 'Ferdig!';
      case 'failed':
        return 'Feilet';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'processing':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: minimized ? 300 : 400,
        zIndex: 999,
        transition: 'all 0.3s ease',
        opacity: visible ? 1 : 0}}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          bgcolor: status === 'completed' ? 'success.light' : status === 'failed' ? 'error.light' : 'primary.light',
          color: 'white'}}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          {getStatusIcon()}
          <Typography variant="subtitle2" noWrap>
            Genererer modell...
          </Typography>
          <Chip
            label={getStatusText()}
            size="small"
            color={getStatusColor() as any}
            sx={{ ml: 'auto' }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={minimized ? 'Utvid' : 'Minimer'}>
            <IconButton size="small" onClick={() => setMinimized(!minimized)} sx={{ color: 'white' }}>
              {minimized ? <MaximizeIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Lukk">
            <IconButton size="small" onClick={onCancel} sx={{ color: 'white' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Content */}
      <Collapse in={!minimized}>
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} noWrap>
            "{prompt}"
          </Typography>

          {status === 'failed' && error ? (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {error}
            </Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Fremdrift
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ mb: 1, height: 6, borderRadius: 3 }}
              />
              {status ==='processing' && progress < 100 && (
                <Typography variant="caption" color="text.secondary">
                  Estimert tid: {Math.ceil((100 - progress) / 2)} sekunder
                </Typography>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

