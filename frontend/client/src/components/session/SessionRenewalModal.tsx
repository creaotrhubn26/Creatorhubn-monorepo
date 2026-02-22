import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Security as SecurityIcon,
  AccessTime as TimeIcon,
  ExitToApp as LogoutIcon,
  Refresh as RenewIcon,
} from '@mui/icons-material';
import { useUniversalSession } from '../../contexts/UniversalSessionContext';

interface SessionRenewalModalProps {
  open: boolean;
  onClose: () => void
}

export function SessionRenewalModal({ open, onClose }: SessionRenewalModalProps) {
  const { sessionWarning, extendSession, logout, timeUntilExpiry } = useUniversalSession();
  
  // Theming system
  const theming = useTheming('photographer');
  const [isExtending, setIsExtending] = useState(false);
  const [autoLogoutCountdown, setAutoLogoutCountdown] = useState(5 * 60); // 5 minutes

  // Auto-logout countdown
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setAutoLogoutCountdown(prev => {
        if (prev <= 1) {
          logout();
          return 0;
      }
        return prev - 1;
    });
  }, 1000);

    return () => clearInterval(interval);
}, [open, logout]);

  // Reset countdown when modal opens
  useEffect(() => {
    if (open) {
      setAutoLogoutCountdown(5 * 60);
  }
}, [open]);

  const handleExtendSession = async () => {
    setIsExtending(true);
    try {
      const success = await extendSession();
      if (success) {
        onClose();
    }
  } catch (error) {
      console.error('Failed to extend session:', error);
  } finally {
      setIsExtending(false);
  }
};

  const handleLogout = async () => {
    await logout();
};

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressValue = Math.max(0, (autoLogoutCountdown / (5 * 60)) * 100);

  return (
    <Dialog
      open={open}
      onClose={() => {}} // Prevent closing by clicking outside
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }
    }}
    >
      <DialogTitle sx={{ pb:  2 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <SecurityIcon color="warning" fontSize="large" />
          <Typography variant="h5" fontWeight="bold" sx={{ color: theming.colors.primary }}>
            Sikkerhetspåminnelse
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ py:  3 }}>
        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="body1" gutterBottom>
            <strong>For din sikkerhet</strong> sjekker vi om du fortsatt bruker CreatorHub Norge-plattformen.
          </Typography>
        </Alert>

        <Box sx={{ mb:  3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Vil du fortsatt være innlogget?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            Hvis du ikke svarer innen {formatTime(autoLogoutCountdown)}, logger vi deg ut automatisk.
          </Typography>
        </Box>

        {/* Session Info */}
        <Box sx={{ mb:  3, p: 2, bgcolor: 'grey.5', borderRadius:  2 }}>
          <Box display="flex" alignItems="center" gap={1} sx={{ mb:  2 }}>
            <TimeIcon fontSize="small" />
            <Typography variant="body2" fontWeight="medium">
              Gjenstående session-tid: </Typography>
            <Chip 
              label={formatTime(timeUntilExpiry)}
              color="warning" 
              size="small"
              variant="outlined"
            />
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            Ved å fortsette får du 24 timer til på plattformen
          </Typography>
        </Box>

        {/* Auto-logout countdown */}
        <Box sx={{ mb:  2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb:  1 }}>
            <Typography variant="body2" color="text.secondary">
              Automatisk utlogging om: </Typography>
            <Typography variant="body2" fontWeight="bold" color="warning.main">
              {formatTime(autoLogoutCountdown)}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progressValue}
            color="warning"
            sx={{ height:  8, borderRadius:  4 }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p:  3, gap:  2 }}>
        <Button
          onClick={handleLogout}
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          sx={{ flex:  1 }}
        >
          Logg meg ut
        </Button>
        
        <Button onClick={handleExtendSession}
          variant="contained"
          color="primary"
          startIcon={<RenewIcon />}
          disabled={isExtending}
          sx={{ flex:  1 }}
          size="large"
        >
          {isExtending ? 'Fornyer...' : 'Ja, fortsett'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SessionRenewalModal;