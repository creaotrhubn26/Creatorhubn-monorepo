import { useTheming } from '../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Switch,
  FormControlLabel,
  Typography,
  Alert,
  Snackbar,
  Chip,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Info,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface DemoModeToggleProps {
  showLabel?: boolean;
  showInfo?: boolean;
  compact?: boolean;
}

export default function DemoModeToggle({ 
  showLabel = true, 
  showInfo = true,
  compact = false 
}: DemoModeToggleProps) {
  const { isDemoMode, toggleDemoMode, isLoading, error } = useDemoMode();
  
  // Theming system
  const theming = useTheming('photographer');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState(', ');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const handleToggle = async () => {
    if (isDemoMode) {
      // If currently in demo mode, show confirmation dialog
      setConfirmDialogOpen(true);
  } else {
      // If not in demo mode, toggle directly
      await performToggle();
  }
};

  const performToggle = async () => {
    try {
      await toggleDemoMode();
      setSnackbarMessage(
        isDemoMode 
          ? 'Demo-modus deaktivert - Produksjonssystem aktivt'
          : 'Demo-modus aktivert - Rikelige simulerte data som viser full funksjonalitet'
      );
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
  } catch (error) {
      console.error('Error toggling demo mode: ', error);
      setSnackbarMessage('Feil ved endring av demo-modus');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
  }
};

  const handleConfirmToggle = async () => {
    setConfirmDialogOpen(false);
    await performToggle();
};

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
};

  if (compact) {
    return (
      <Box>
        <Tooltip title={isDemoMode ? 'Demo-modus aktivert' : 'Demo-modus deaktivert'}>
          <IconButton
            onClick={handleToggle}
            disabled={isLoading}
            color={isDemoMode ? 'primary' : 'default'}
          >
            {isLoading ? (
              <CircularProgress size={20} />
            ) : isDemoMode ? (
              <Visibility />
            ) : (
              <VisibilityOff />
            )}
          </IconButton>
        </Tooltip>
        
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbarSeverity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    );
}

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={isDemoMode}
            onChange={handleToggle}
            disabled={isLoading}
            color="primary"
          />
      }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              Demo-modus
            </Typography>
            <Chip
              icon={isDemoMode ? <Visibility /> : <VisibilityOff />}
              label={isDemoMode ? 'Aktivert' : 'Deaktivert'}
              color={isDemoMode ? 'primary' : 'default'}
              size="small"
              variant={isDemoMode ? 'filled' : 'outlined'}
            />
            {isLoading && <CircularProgress size={16} />}
          </Box>
        }
      />

      {showInfo && (
        <Box sx={{ mt: 1 }}>
          <Alert 
            severity={isDemoMode ? 'info' : 'success'} 
            icon={isDemoMode ? <Info /> : <CheckCircle />}
            sx={{ fontSize: '0.875rem' }}
          >
            {isDemoMode 
              ? 'Demo-modus aktivert - Rikelige simulerte data som viser full funksjonalitet' : 'Produksjonssystem - tomt til ekte data fylles inn'
          }
          </Alert>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Bekreft endring av demo-modus
        </DialogTitle>
        <DialogContent>
          <Typography>
            Du er i ferd med å deaktivere demo-modus. Dette vil skjule alle simulerte data 
            og vise kun ekte data fra databasen. Er du sikker på at du vil fortsette?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleConfirmToggle}
            color="primary"
            variant="contained"
            sx={theming.getThemedButtonSx()}
          >
            Bekreft
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity}
          sx={{ width:'100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
